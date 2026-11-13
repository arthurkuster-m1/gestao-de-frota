/**
 * A BUSCA das anotações: o texto do documento do editor, achatado e sem acento, para o banco
 * procurar com `ilike`. O mesmo "sem acento" vale na gravação (aqui) e na consulta (aqui), e é o
 * mesmo mapa da migration 0687 — por isso é uma tabela explícita e não `normalize("NFD")`.
 */
const COM_ACENTO = "áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ";
const SEM_ACENTO = "aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn";

const MAPA = new Map([...COM_ACENTO].map((c, i) => [c, SEM_ACENTO[i]!]));

/** Minúsculas e sem acento, com o mesmo comprimento do texto original (para achar o trecho certo). */
export function dobrar(texto: string): string {
  let saida = "";
  for (const c of texto) saida += MAPA.get(c) ?? c;
  return saida.toLowerCase();
}

/** O texto que a pessoa digitou na busca, pronto para ir ao `ilike` (sem os caracteres que quebram o filtro). */
export function termoDeBusca(bruto: string): string {
  return dobrar(bruto)
    .replace(/[%_\\,()*"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export const TETO_DO_TEXTO_DE_BUSCA = 200_000;

/** O texto corrido do documento (nós do Tiptap): cada bloco numa linha; texto de células, listas e toggles entram. */
export function textoDoDocumento(documento: readonly unknown[]): string {
  const partes: string[] = [];
  const BLOCOS_DE_TEXTO = new Set(["paragraph", "heading", "codeBlock", "detailsSummary"]);
  const juntar = (n: unknown, saida: string[]): void => {
    if (typeof n !== "object" || n === null) return;
    const no = n as { type?: unknown; text?: unknown; content?: unknown };
    if (typeof no.text === "string") saida.push(no.text);
    else if (no.type === "hardBreak") saida.push(" ");
    if (Array.isArray(no.content)) for (const f of no.content) juntar(f, saida);
  };
  const anda = (nos: readonly unknown[]) => {
    for (const n of nos) {
      if (typeof n !== "object" || n === null) continue;
      const no = n as { type?: unknown; content?: unknown };
      if (typeof no.type === "string" && BLOCOS_DE_TEXTO.has(no.type)) {
        const linha: string[] = [];
        juntar(no, linha);
        const t = linha.join("");
        if (t.trim()) partes.push(t);
      } else if (Array.isArray(no.content)) anda(no.content);
    }
  };
  anda(documento);
  return partes.join("\n").slice(0, TETO_DO_TEXTO_DE_BUSCA);
}

/** Os três campos de busca de uma página, a partir do título e do documento. */
export function camposDeBusca(titulo: string, documento: readonly unknown[]) {
  const texto = textoDoDocumento(documento);
  return {
    search_text: texto,
    search_fold: dobrar(texto),
    title_fold: dobrar(titulo).slice(0, 400),
  };
}

/** Um trecho do texto em volta do primeiro lugar onde o termo aparece. */
export function trechoDaBusca(texto: string, termo: string, raio = 60): string {
  const i = dobrar(texto).indexOf(termo);
  if (i < 0)
    return texto
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, raio * 2);
  const inicio = Math.max(0, i - raio);
  const fim = Math.min(texto.length, i + termo.length + raio);
  const corte = texto.slice(inicio, fim).replace(/\s+/g, " ").trim();
  return `${inicio > 0 ? "…" : ""}${corte}${fim < texto.length ? "…" : ""}`;
}
