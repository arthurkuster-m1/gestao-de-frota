import { diferencaEmDias, somarDias } from "../motor/datas";

/** A escala do eixo do tempo: quantos pixels vale um dia. */
export type Escala = "dia" | "semana";
export const LARGURA_DO_DIA: Record<Escala, number> = { dia: 44, semana: 16 };

/** Posição (px, a partir da esquerda do eixo) do começo de um dia. */
export const posicaoDoDia = (dia: string, origem: string, larguraDia: number) => diferencaEmDias(origem, dia) * larguraDia;
/** Largura (px) de um período em dias INCLUSIVOS (um dia só = uma coluna). */
export const larguraDoPeriodo = (inicio: string, fim: string, larguraDia: number) => (diferencaEmDias(inicio, fim) + 1) * larguraDia;
/** O dia sob uma posição em px (para arrastar e para clicar no eixo). */
export const diaNaPosicao = (px: number, origem: string, larguraDia: number) => somarDias(origem, Math.floor(px / larguraDia));

export const gerarDias = (origem: string, n: number): string[] => Array.from({ length: n }, (_, i) => somarDias(origem, i));

/** Os meses do eixo, com quantos dias cada um ocupa (para o cabeçalho de cima). */
export function mesesDoEixo(origem: string, dias: number): { chave: string; dias: number }[] {
  const saida: { chave: string; dias: number }[] = [];
  for (const d of gerarDias(origem, dias)) {
    const chave = d.slice(0, 7);
    const ultimo = saida[saida.length - 1];
    if (ultimo && ultimo.chave === chave) ultimo.dias++; else saida.push({ chave, dias: 1 });
  }
  return saida;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const nomeDoMes = (chave: string) => `${MESES[Number(chave.slice(5, 7)) - 1]} ${chave.slice(0, 4)}`;
