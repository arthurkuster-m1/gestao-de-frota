import type { Barra } from "../linhaDoTempo/tipos";
import { reservavelPeloCiclo } from "../eventos/uso";
import type { Veiculo } from "./tipos";

/** Os marcos que podem ter PREVISÃO: a data de quando vai acontecer, antes de acontecer. A data real continua sendo outro campo. */
export const MARCOS_PREVISTOS = [
  { id: "liberacao", rotulo: "liberação", previsto: "data_liberacao_prevista", real: "data_liberacao" },
  { id: "faturamento", rotulo: "faturamento", previsto: "data_faturamento_prevista", real: "data_faturamento" },
  { id: "emplacamento", rotulo: "emplacamento", previsto: "data_emplacamento_prevista", real: "data_emplacamento" },
] as const;
export type MarcoPrevisto = (typeof MARCOS_PREVISTOS)[number];
type Carro = Pick<Veiculo, "status_ciclo"> & Partial<Pick<Veiculo, MarcoPrevisto["previsto"] | MarcoPrevisto["real"]>>;

/** Ainda em previsão: tem a data prevista e a real ainda está vazia. */
export const previsoesPendentes = (v: Carro): { marco: MarcoPrevisto; data: string }[] =>
  MARCOS_PREVISTOS.flatMap((m) => { const d = v[m.previsto]; return d && !v[m.real] ? [{ marco: m, data: d }] : []; });

/** A data chegou (hoje ou antes): é hora de confirmar se realmente aconteceu. */
export const previsoesQueChegaram = (v: Carro, hoje: string) => previsoesPendentes(v).filter((p) => p.data <= hoje);

/** O que gravar quando a pessoa confirma "foi realizado": a previsão vira a data real (o ciclo avança sozinho, como sempre) e deixa de ser previsão. */
export const patchDeConfirmacao = (v: Carro, m: MarcoPrevisto): Record<string, string | null> => ({ [m.real]: v[m.previsto] ?? null, [m.previsto]: null });
/** Adiar: só a data prevista muda. */
export const patchDeAdiamento = (m: MarcoPrevisto, nova: string): Record<string, string | null> => ({ [m.previsto]: nova });

/**
 * A partir de quando o carro, hoje bloqueado pelo ciclo (Pedido recebido, Liberado, Em transporte 0km), pode ser reservado: a primeira data prevista que ainda não aconteceu.
 * null = ele já é reservável pelo ciclo, ou não tem previsão (continua indisponível).
 */
export function disponivelAPartirDe(v: Carro): string | null {
  if (reservavelPeloCiclo(v.status_ciclo)) return null;
  if (!["pedido_recebido", "liberado", "em_transporte_0km"].includes(v.status_ciclo)) return null;   // blindagem, gravame, venda VIP e devolvido seguem bloqueados
  return previsoesPendentes(v).map((p) => p.data).sort()[0] ?? null;
}

/** Na linha do tempo: do hoje até a data prevista, o carro está "aguardando liberação" (cinza, não arrasta). */
export function barrasDePrevisao(v: Carro & { id: string }, hoje: string): Barra[] {
  const ate = disponivelAPartirDe(v);
  if (!ate || ate <= hoje) return [];
  return [{ id: `previsao:${v.id}`, inicio: hoje, fim: ate, rotulo: `Aguardando liberação · prevista ${ate.slice(8, 10)}/${ate.slice(5, 7)}`, tom: "neutral", dados: { previsaoDoVeiculo: v.id } }];
}
export const ehBarraDePrevisao = (b: Barra) => !!(b.dados as { previsaoDoVeiculo?: string } | undefined)?.previsaoDoVeiculo;
