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
