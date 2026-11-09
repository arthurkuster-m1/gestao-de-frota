import type { Barra } from "../linhaDoTempo/tipos";
import type { AnotacaoDoCarro } from "../eventos/tipos";

/** Sugestões de título (o campo é livre). */
export const SUGESTOES_DE_ANOTACAO = ["Produção", "Em faturamento", "Emplacamento", "Em transporte", "Aguardando liberação"] as const;

/** As anotações de UM carro viram faixas na linha do tempo dele (não aparecem em Eventos nem em Manutenções). */
export const barrasDeAnotacao = (notas: readonly AnotacaoDoCarro[]): Barra[] =>
  notas.map((n) => ({ id: n.id, inicio: n.inicio, fim: n.fim, rotulo: n.titulo, tom: "info", movel: true, esticavel: true, dados: { anotacaoId: n.id } }));
export const ehBarraDeAnotacao = (b: Barra) => !!(b.dados as { anotacaoId?: string } | undefined)?.anotacaoId;

export function anotacoesPorVeiculo(notas: readonly AnotacaoDoCarro[]): Map<string, AnotacaoDoCarro[]> {
  const m = new Map<string, AnotacaoDoCarro[]>();
  for (const n of notas) { const l = m.get(n.veiculo_id); if (l) l.push(n); else m.set(n.veiculo_id, [n]); }
  return m;
}
