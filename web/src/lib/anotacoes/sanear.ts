/**
 * SANEAR: deixa o documento do editor (Tiptap) só com o que o editor entende.
 * - tipo de nó desconhecido: abre (o conteúdo fica, a "casca" some);
 * - marca desconhecida some; link com protocolo perigoso vira texto;
 * - título de 1 a 3; profundidade limitada.
 */
export interface NoTiptap {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NoTiptap[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export const PROFUNDIDADE_MAXIMA = 12;
const NOS_CONHECIDOS = new Set([
  "paragraph", "heading", "bulletList", "orderedList", "listItem", "taskList", "taskItem", "blockquote", "codeBlock",
  "horizontalRule", "hardBreak", "table", "tableRow", "tableHeader", "tableCell", "details", "detailsSummary", "detailsContent", "subpagina", "text",
]);
const MARCAS_CONHECIDAS = new Set(["bold", "italic", "underline", "strike", "code", "link"]);
const PROTOCOLOS = ["http:", "https:", "mailto:", "tel:"];

/** O endereço só vale com http, https, mailto ou tel (e sem caracteres de controle escondidos). */
export function linkSeguro(href: unknown): boolean {
  if (typeof href !== "string") return false;
  // eslint-disable-next-line no-control-regex
  const limpo = href.replace(/[\u0000- \u007f-\u009f]/g, "");
  try { return PROTOCOLOS.includes(new URL(limpo).protocol); } catch { return false; }
}

function saneMarcas(marcas: unknown): NoTiptap["marks"] {
  if (!Array.isArray(marcas)) return undefined;
  const saida: NonNullable<NoTiptap["marks"]> = [];
  for (const m of marcas) {
    if (typeof m !== "object" || m === null) continue;
    const tipo = (m as { type?: unknown }).type;
    if (typeof tipo !== "string" || !MARCAS_CONHECIDAS.has(tipo)) continue;
    if (tipo === "link") {
      const href = (m as { attrs?: { href?: unknown } }).attrs?.href;
      if (!linkSeguro(href)) continue;
      saida.push({ type: "link", attrs: { href: String(href) } });
    } else saida.push({ type: tipo });
  }
  return saida.length ? saida : undefined;
}

function textoDe(no: unknown): string {
  if (typeof no !== "object" || no === null) return "";
  const n = no as { text?: unknown; content?: unknown };
  if (typeof n.text === "string") return n.text;
  return Array.isArray(n.content) ? n.content.map(textoDe).join(" ") : "";
}

function saneNo(bruto: unknown, nivel: number): NoTiptap[] {
  if (typeof bruto !== "object" || bruto === null) return [];
  const b = bruto as { type?: unknown; attrs?: Record<string, unknown>; content?: unknown; marks?: unknown; text?: unknown };
  if (typeof b.type !== "string") return [];
  if (b.type === "text") {
    if (typeof b.text !== "string" || b.text === "") return [];
    const marks = saneMarcas(b.marks);
    return [{ type: "text", text: b.text, ...(marks ? { marks } : {}) }];
  }
  const filhos = Array.isArray(b.content) ? b.content : [];
  // Fundo demais: vira um parágrafo com o texto corrido.
  if (nivel >= PROFUNDIDADE_MAXIMA) {
    const t = textoDe(b).trim();
    return t ? [{ type: "paragraph", content: [{ type: "text", text: t }] }] : [];
  }
  const conteudo = filhos.flatMap((f) => saneNo(f, nivel + 1));
  if (!NOS_CONHECIDOS.has(b.type)) return conteudo;   // abre: o conteúdo fica
  const no: NoTiptap = { type: b.type };
  const a = b.attrs ?? {};
  switch (b.type) {
    case "heading": { const n = Number(a.level); no.attrs = { level: n >= 1 && n <= 3 ? Math.trunc(n) : n > 3 ? 3 : 1 }; break; }
    case "orderedList": { const s = Number(a.start); no.attrs = { start: Number.isFinite(s) && s >= 1 ? Math.trunc(s) : 1 }; break; }
    case "taskItem": no.attrs = { checked: a.checked === true }; break;
    case "codeBlock": if (typeof a.language === "string" && /^[\w+#-]{1,30}$/.test(a.language)) no.attrs = { language: a.language }; break;
    case "details": no.attrs = { open: a.open === true }; break;
    case "subpagina": if (typeof a.pageId !== "string" || !a.pageId) return []; no.attrs = { pageId: a.pageId.slice(0, 64) }; break;
    case "tableHeader": case "tableCell": {
      const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) >= 1 ? Math.min(Math.trunc(Number(v)), 50) : 1);
      no.attrs = { colspan: num(a.colspan), rowspan: num(a.rowspan), colwidth: Array.isArray(a.colwidth) ? a.colwidth.filter((x) => typeof x === "number") : null };
      break;
    }
    default: break;
  }
  if (b.type === "subpagina" || b.type === "horizontalRule" || b.type === "hardBreak") return [no];
  if (conteudo.length) no.content = conteudo;
  return [no];
}

/** O documento (lista de nós do nível mais alto) limpo. */
export function sanear(documento: unknown, maximo = 3000): NoTiptap[] {
  if (!Array.isArray(documento)) return [];
  return documento.slice(0, maximo).flatMap((n) => saneNo(n, 0));
}
