import { somarDias } from "../motor/datas";
import type { ModoDeArrasto } from "../linhaDoTempo/tipos";
import type { Reserva } from "../eventos/tipos";
import type { Manutencao } from "./tipos";

/** Sem data de fim e ainda não pronta: o carro continua na oficina, então o período não tem fim conhecido. */
export const FIM_ABERTO = "9999-12-31";

/** A manutenção ainda segura o carro? (não está pronta E o Arthur marcou que ela bloqueia o uso). */
export const bloqueiaAgora = (m: Pick<Manutencao, "status" | "bloqueia_uso">) => m.bloqueia_uso && m.status !== "pronto";
/** Em aberto = ainda não ficou pronta (bloqueando ou não). */
export const estaEmAberto = (m: Pick<Manutencao, "status">) => m.status !== "pronto";

/** O período usado nos conflitos: sem fim e em aberto vale "para sempre"; pronta sem fim termina no início. */
export const periodoDeConflito = (m: Pick<Manutencao, "data_inicio" | "data_fim" | "status">) => ({ inicio: m.data_inicio, fim: m.data_fim ?? (m.status === "pronto" ? m.data_inicio : FIM_ABERTO) });

/** O fim que a barra da linha do tempo mostra: o fim real, ou "até hoje" enquanto está aberta (nunca antes do início). */
export const fimDaBarra = (m: Pick<Manutencao, "data_inicio" | "data_fim">, hoje: string) => m.data_fim ?? (hoje > m.data_inicio ? hoje : m.data_inicio);

/** As manutenções que bloqueiam o carro em algum dia do período (datas inclusivas). */
export function manutencoesQueBloqueiam(periodo: { inicio: string; fim: string }, doCarro: readonly Manutencao[]): Manutencao[] {
  return doCarro.filter((m) => { if (!bloqueiaAgora(m)) return false; const p = periodoDeConflito(m); return p.inicio <= periodo.fim && periodo.inicio <= p.fim; });
}

/** Agrupa as manutenções por carro. */
export function manutencoesPorVeiculo(ms: readonly Manutencao[]): Map<string, Manutencao[]> {
  const map = new Map<string, Manutencao[]>();
  for (const m of ms) { const l = map.get(m.veiculo_id); if (l) l.push(m); else map.set(m.veiculo_id, [m]); }
  return map;
}

/**
 * O evento responsável: o evento em que o carro estava no dia do acidente. É CALCULADO (nunca digitado): a reserva não cancelada
 * do carro que cobre `data_ocorrencia`. Se houver mais de uma (troca de carro), vale a que começou por último.
 */
export function eventoResponsavel(m: Pick<Manutencao, "data_ocorrencia">, reservasDoCarro: readonly Reserva[]): string | null {
  const dia = m.data_ocorrencia; if (!dia) return null;
  const cobre = reservasDoCarro.filter((r) => r.estado !== "cancelado" && r.reserva_inicio <= dia && dia <= r.reserva_fim);
  if (cobre.length === 0) return null;
  return cobre.sort((a, b) => b.reserva_inicio.localeCompare(a.reserva_inicio))[0]!.evento_id;
}

export type DatasDaManutencao = { data_inicio: string; data_fim: string | null };

/**
 * As datas depois de arrastar a barra `delta` dias. Mover leva início e fim; esticar o início muda só o início; esticar o fim
 * dá um fim à manutenção (se ainda não tinha, parte do fim que a barra mostra). Nunca deixa o fim antes do início.
 */
export function reajustarManutencao(m: DatasDaManutencao, modo: ModoDeArrasto, delta: number, hoje: string): DatasDaManutencao {
  if (modo === "mover") return { data_inicio: somarDias(m.data_inicio, delta), data_fim: m.data_fim && somarDias(m.data_fim, delta) };
  if (modo === "inicio") { const novo = somarDias(m.data_inicio, delta); const fim = m.data_fim; return { data_inicio: fim && novo > fim ? fim : novo, data_fim: fim }; }
  const base = fimDaBarra(m, hoje); const novo = somarDias(base, delta);
  return { data_inicio: m.data_inicio, data_fim: novo < m.data_inicio ? m.data_inicio : novo };
}
