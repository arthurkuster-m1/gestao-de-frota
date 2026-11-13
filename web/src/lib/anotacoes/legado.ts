import { linkSeguro, type NoTiptap } from "./sanear";

/**
 * O FORMATO ANTIGO (blocos do BlockNote: cada bloco tem `id`, `type`, `props`, `content`, `children`)
 * convertido para nós do Tiptap. Só roda ao LER a página; ela só é regravada se a pessoa editar.
 */
type Antigo = { id?: unknown; type?: unknown; props?: Record<string, unknown>; content?: unknown; children?: unknown };

export function ehFormatoAntigo(valor: unknown): boolean {
  return Array.isArray(valor) && valor.some((b) => typeof b === "object" && b !== null && typeof (b as Antigo).id === "string" && typeof (b as Antigo).type === "string");
}

const MARCAS: Record<string, string> = { bold: "bold", italic: "italic", underline: "underline", strike: "strike", code: "code" };

function inline(itens: unknown, marcasDeFora: NonNullable<NoTiptap["marks"]> = []): NoTiptap[] {
  if (!Array.isArray(itens)) return [];
  return itens.flatMap((i): NoTiptap[] => {
    if (typeof i === "string") return i ? [{ type: "text", text: i, ...(marcasDeFora.length ? { marks: marcasDeFora } : {}) }] : [];
    if (typeof i !== "object" || i === null) return [];
    const it = i as { type?: unknown; text?: unknown; styles?: Record<string, unknown>; href?: unknown; content?: unknown };
    if (it.type === "link") {
      const extra = linkSeguro(it.href) ? [...marcasDeFora, { type: "link", attrs: { href: String(it.href) } }] : marcasDeFora;
      return inline(it.content, extra);
    }
    if (typeof it.text !== "string" || it.text === "") return [];
    const marks = [...marcasDeFora];
    for (const [estilo, marca] of Object.entries(MARCAS)) if (it.styles?.[estilo] === true) marks.push({ type: marca });
    return [{ type: "text", text: it.text, ...(marks.length ? { marks } : {}) }];
  });
}

const paragrafo = (conteudo: NoTiptap[]): NoTiptap => ({ type: "paragraph", ...(conteudo.length ? { content: conteudo } : {}) });
const texto = (t: string): NoTiptap[] => (t.trim() ? [{ type: "text", text: t }] : []);

function lista(bruto: unknown): { titulo: string; texto: string }[] {
  try {
    const v: unknown = JSON.parse(String(bruto));
    return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? { titulo: x, texto: "" } : { titulo: String((x as { titulo?: unknown })?.titulo ?? ""), texto: String((x as { texto?: unknown })?.texto ?? "") })) : [];
  } catch { return []; }
}

const TIPOS_DE_ITEM: Record<string, { lista: string; item: string }> = {
  bulletListItem: { lista: "bulletList", item: "listItem" },
  numberedListItem: { lista: "orderedList", item: "listItem" },
  checkListItem: { lista: "taskList", item: "taskItem" },
};

function tabela(b: Antigo): NoTiptap[] {
  const c = b.content as { rows?: unknown; headerRows?: unknown } | undefined;
  const linhas = Array.isArray(c?.rows) ? (c!.rows as { cells?: unknown }[]) : [];
  const cabecalho = Number(c?.headerRows) || 0;
  const rows = linhas.map((l, i): NoTiptap => {
    const celulas = Array.isArray(l.cells) ? l.cells : [];
    return { type: "tableRow", content: celulas.map((cel): NoTiptap => {
      const conteudo = Array.isArray(cel) ? cel : (cel as { content?: unknown })?.content;
      return { type: i < cabecalho ? "tableHeader" : "tableCell", content: [paragrafo(inline(conteudo))] };
    }) };
  }).filter((r) => r.content?.length);
  return rows.length ? [{ type: "table", content: rows }] : [];
}

/** Converte uma lista de blocos antigos (de um mesmo nível), juntando itens de lista seguidos numa lista só. */
export function converterBlocos(blocos: unknown): NoTiptap[] {
  if (!Array.isArray(blocos)) return [];
  const saida: NoTiptap[] = [];
  let atual: NoTiptap | null = null;
  let tipoAtual = "";
  for (const bruto of blocos) {
    if (typeof bruto !== "object" || bruto === null) continue;
    const b = bruto as Antigo;
    const tipo = String(b.type ?? "");
    const filhos = converterBlocos(b.children);
    const info = TIPOS_DE_ITEM[tipo];
    if (info) {
      if (!atual || tipoAtual !== tipo) { atual = { type: info.lista, content: [] }; tipoAtual = tipo; saida.push(atual); }
      const item: NoTiptap = { type: info.item, ...(tipo === "checkListItem" ? { attrs: { checked: b.props?.checked === true } } : {}), content: [paragrafo(inline(b.content)), ...filhos] };
      atual.content!.push(item);
      continue;
    }
    atual = null; tipoAtual = "";
    saida.push(...converterUm(b, tipo, filhos));
  }
  return saida;
}

function converterUm(b: Antigo, tipo: string, filhos: NoTiptap[]): NoTiptap[] {
  const p = b.props ?? {};
  switch (tipo) {
    case "paragraph": return [paragrafo(inline(b.content)), ...filhos];
    case "heading": { const n = Number(p.level); return [{ type: "heading", attrs: { level: n >= 1 && n <= 3 ? n : n > 3 ? 3 : 1 }, ...(inline(b.content).length ? { content: inline(b.content) } : {}) }, ...filhos]; }
    case "quote": return [{ type: "blockquote", content: [paragrafo(inline(b.content))] }, ...filhos];
    case "codeBlock": { const t = inline(b.content).map((x) => x.text).join(""); return [{ type: "codeBlock", ...(typeof p.language === "string" && p.language ? { attrs: { language: p.language } } : {}), ...(t ? { content: [{ type: "text", text: t }] } : {}) }]; }
    case "divider": return [{ type: "horizontalRule" }, ...filhos];
    case "toggleListItem": return [{ type: "details", attrs: { open: false }, content: [{ type: "detailsSummary", ...(inline(b.content).length ? { content: inline(b.content) } : {}) }, { type: "detailsContent", content: filhos.length ? filhos : [paragrafo([])] }] }];
    case "table": return [...tabela(b), ...filhos];
    case "subpagina": return typeof p.pageId === "string" && p.pageId ? [{ type: "subpagina", attrs: { pageId: p.pageId } }] : [];
    case "destaque": return [{ type: "blockquote", content: [paragrafo(inline(b.content))] }, ...filhos];
    case "fluxo": case "cartoes": case "metricas": case "matriz": {
      const itens = lista(p.dados);
      return itens.flatMap((it): NoTiptap[] => [
        ...(it.titulo.trim() ? [{ type: "heading", attrs: { level: 3 }, content: texto(it.titulo) }] : []),
        ...(it.texto.trim() ? [paragrafo(texto(it.texto))] : []),
      ]);
    }
    case "piramide": {
      const itens = lista(p.dados).filter((x) => x.titulo.trim());
      return itens.length ? [{ type: "bulletList", content: itens.map((x): NoTiptap => ({ type: "listItem", content: [paragrafo(texto(x.titulo))] })) }] : [];
    }
    case "image": case "video": case "audio": case "file": {
      const legenda = String(p.caption || p.name || "").trim();
      return legenda ? [paragrafo(texto(legenda))] : [];
    }
    default: {
      // Tipo que não conhecemos: guarda o texto que tiver.
      const t = inline(b.content);
      return [...(t.length ? [paragrafo(t)] : []), ...filhos];
    }
  }
}

