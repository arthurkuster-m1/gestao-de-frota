import { diferencaEmDias } from "../motor/datas";
import type { EstadoReserva } from "../eventos/tipos";
import type { Momento } from "./tipos";

/** O estado da reserva depois de um checklist NOVO (o banco faz igual): só para a frente; cancelada e concluída ficam como estão. */
export function estadoAposChecklist(atual: EstadoReserva, momento: Momento): EstadoReserva {
  if (momento === "saida") return atual === "reservado" ? "em_uso" : atual;
  return atual === "reservado" || atual === "em_uso" || atual === "em_retorno" ? "concluido" : atual;
}

/** Data e hora de São Paulo → instante (SP não tem horário de verão desde 2019). */
export const paraInstante = (dia: string, hora: string) => `${dia}T${hora || "00:00"}:00-03:00`;
const FUSO = "America/Sao_Paulo";
export const diaDe = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO }).format(new Date(iso));
export const horaDe = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
export const quandoFoi = (iso: string) => `${diaDe(iso).split("-").reverse().join("/")} ${horaDe(iso)}`;
export const kmTexto = (km: number | null) => (km === null ? null : `${km.toLocaleString("pt-BR")} km`);

/** As reservas (ids) que ainda NÃO têm checklist daquele momento (cancelada e concluída não contam). */
export function reservasSemChecklist(reservas: readonly { id: string; estado: EstadoReserva }[], checklists: readonly { reserva_id: string; momento: Momento }[], momento: Momento): string[] {
  const tem = new Set(checklists.filter((c) => c.momento === momento).map((c) => c.reserva_id));
  return reservas.filter((r) => r.estado !== "cancelado" && r.estado !== "concluido" && !tem.has(r.id)).map((r) => r.id);
}

/**
 * Qual reserva (evento) do carro o checklist de hoje deve usar? Só entram as que ainda não têm o checklist daquele momento (cancelada e concluída não).
 * Ordem: ENVIO → a que cobre hoje, depois a que começa mais perto; RETORNO → a que já está em uso/retorno, depois a que cobre hoje.
 * Reserva sem data vai por último. O primeiro da lista é a sugestão.
 */
export function reservasParaChecklist<R extends { id: string; estado: EstadoReserva; reserva_inicio: string | null; reserva_fim: string | null }>(
  reservasDoCarro: readonly R[], checklists: readonly { reserva_id: string; momento: Momento }[], momento: Momento, hoje: string,
): R[] {
  const feitos = new Set(checklists.filter((c) => c.momento === momento).map((c) => c.reserva_id));
  const rank = (r: R): number[] => {
    if (!r.reserva_inicio || !r.reserva_fim) return [9, 0];
    const cobreHoje = r.reserva_inicio <= hoje && hoje <= r.reserva_fim;
    const distancia = Math.abs(diferencaEmDias(hoje, r.reserva_inicio));
    if (momento === "retorno") return [r.estado === "em_uso" || r.estado === "em_retorno" ? 0 : 1, cobreHoje ? 0 : 1, distancia];
    return [cobreHoje ? 0 : r.reserva_inicio >= hoje ? 1 : 2, distancia];
  };
  return reservasDoCarro.filter((r) => r.estado !== "cancelado" && r.estado !== "concluido" && !feitos.has(r.id))
    .sort((a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d; } return 0; });
}
