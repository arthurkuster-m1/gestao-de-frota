import type { Coluna, Linha, Opcao } from "./tipos";

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** O texto de uma opção → o valor dela (aceita o rótulo ou o próprio valor, sem diferenciar maiúsculas e acentos); texto desconhecido fica como veio (a validação aponta). */
export function textoParaOpcao(texto: string, opcoes: readonly Opcao[]): string {
  const t = norm(texto); if (!t) return "";
  return opcoes.find((o) => norm(o.value) === t || norm(o.label) === t || norm(o.value.replace(/_/g, " ")) === t)?.value ?? texto.trim();
}

/**
 * Matriz colada → linhas da grade. Se a 1ª linha parece cabeçalho (reconhece ao menos metade das colunas pelo título), usa-o para achar
 * cada coluna; senão vale a ordem das colunas da grade. Colunas de opção convertem o rótulo no valor.
 */
export function linhasDeMatriz(matriz: string[][], colunas: readonly Coluna[]): Linha[] {
  const dados = matriz.filter((l) => l.some((c) => (c ?? "").trim() !== ""));
  if (dados.length === 0) return [];
  const mapa = dados[0]!.map((c) => colunas.find((x) => norm(x.titulo) === norm(c ?? "") || norm(x.id) === norm(c ?? "") || norm(x.titulo).startsWith(`${norm(c ?? "")} (`) || norm(c ?? "").startsWith(norm(x.titulo.split(" (")[0]!))));
  const ehCabecalho = mapa.filter(Boolean).length >= Math.max(1, Math.ceil(colunas.length / 2)) || (colunas.length === 1 && mapa.filter(Boolean).length === 1);
  const ordem = ehCabecalho ? mapa : colunas;
  return (ehCabecalho ? dados.slice(1) : dados).map((l) => {
    const o: Linha = {};
    l.forEach((c, i) => { const col = ordem[i]; if (col && (c ?? "").trim() !== "") o[col.id] = col.opcoes ? textoParaOpcao(c, col.opcoes) : c.trim(); });
    return o;
  });
}

/** Colunas de opção com valor que não é nenhuma das opções → mensagem de erro (ou null). */
export function erroDeOpcao(l: Linha, colunas: readonly Coluna[]): string | null {
  for (const c of colunas) {
    const v = l[c.id]; if (!c.opcoes || !v || !v.trim()) continue;
    if (!c.opcoes.some((o) => o.value === v)) return `${c.titulo.split(" (")[0]}: "${v}" não é uma opção (${c.opcoes.slice(0, 6).map((o) => o.label).join(", ")}${c.opcoes.length > 6 ? "…" : ""})`;
  }
  return null;
}
export const linhaEstaVazia = (l: Linha) => Object.values(l).every((v) => !(v ?? "").trim());
