import type { Barra } from "./tipos";

/**
 * Empilha barras que se sobrepõem em "faixas" (linhas dentro da mesma linha da tabela), para duas reservas do mesmo carro
 * no mesmo dia aparecerem uma sobre a outra em vez de uma esconder a outra. Dias inclusivos; guloso por início.
 */
export function empilhar<B extends Pick<Barra, "id" | "inicio" | "fim">>(barras: readonly B[]): { barra: B; faixa: number }[] {
  const ordenadas = [...barras].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim) || a.id.localeCompare(b.id));
  const fimDaFaixa: string[] = [];
  return ordenadas.map((barra) => {
    let f = fimDaFaixa.findIndex((fim) => fim < barra.inicio);
    if (f < 0) { f = fimDaFaixa.length; fimDaFaixa.push(barra.fim); } else fimDaFaixa[f] = barra.fim;
    return { barra, faixa: f };
  });
}
export const totalDeFaixas = (empilhadas: readonly { faixa: number }[]) => empilhadas.reduce((m, e) => Math.max(m, e.faixa + 1), 1);
