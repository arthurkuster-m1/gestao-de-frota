import { somarDias } from "../motor/datas";
import type { ModoDeArrasto } from "./tipos";

/** O período depois de arrastar `deltaDias` dias. Nunca fica com menos de 1 dia (início ≤ fim). */
export function aplicarArrasto(periodo: { inicio: string; fim: string }, modo: ModoDeArrasto, deltaDias: number): { inicio: string; fim: string } {
  if (modo === "mover") return { inicio: somarDias(periodo.inicio, deltaDias), fim: somarDias(periodo.fim, deltaDias) };
  if (modo === "inicio") { const novo = somarDias(periodo.inicio, deltaDias); return { inicio: novo > periodo.fim ? periodo.fim : novo, fim: periodo.fim }; }
  const novo = somarDias(periodo.fim, deltaDias);
  return { inicio: periodo.inicio, fim: novo < periodo.inicio ? periodo.inicio : novo };
}

export type DatasDaReserva = { reserva_inicio: string; reserva_fim: string; chegada: string | null; retirada: string | null };

const preso = (d: string | null, ini: string, fim: string) => (d === null ? null : d < ini ? ini : d > fim ? fim : d);

/**
 * As datas de uma reserva depois de a barra ser arrastada.
 *  - mover: o bloco inteiro anda junto (chegada e retirada acompanham);
 *  - esticar uma ponta: a janela muda e a chegada/retirada, se ficarem de fora, são presas na borda (o banco exige que fiquem dentro).
 */
export function reajustarReserva(r: DatasDaReserva, modo: ModoDeArrasto, deltaDias: number): DatasDaReserva {
  const novo = aplicarArrasto({ inicio: r.reserva_inicio, fim: r.reserva_fim }, modo, deltaDias);
  if (modo === "mover") return { reserva_inicio: novo.inicio, reserva_fim: novo.fim, chegada: r.chegada && somarDias(r.chegada, deltaDias), retirada: r.retirada && somarDias(r.retirada, deltaDias) };
  let chegada = preso(r.chegada, novo.inicio, novo.fim), retirada = preso(r.retirada, novo.inicio, novo.fim);
  if (chegada && retirada && chegada > retirada) { chegada = retirada; }
  return { reserva_inicio: novo.inicio, reserva_fim: novo.fim, chegada, retirada };
}

/** O que mudou entre as datas antigas e as novas (só o que precisa ir ao banco). */
export function diferencas(antes: DatasDaReserva, depois: DatasDaReserva): Partial<DatasDaReserva> {
  const out: Partial<DatasDaReserva> = {};
  (Object.keys(antes) as (keyof DatasDaReserva)[]).forEach((k) => { if (antes[k] !== depois[k]) (out as Record<string, string | null>)[k] = depois[k]; });
  return out;
}
