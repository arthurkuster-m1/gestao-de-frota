import { supabase } from "../supabase";
import type { EstadoReserva, Evento, EventoNovo, Reserva } from "./tipos";

export class ErroEvento extends Error {}
function traduzir(e: { code?: string; message: string }): ErroEvento {
  if (/eventos|evento_veiculos/.test(e.message) && /schema cache|does not exist/.test(e.message)) return new ErroEvento("Eventos e reservas ainda não foram ativados no banco (falta aplicar a migration 0006).");
  if (e.code === "23505") return new ErroEvento(/evento_veiculos_evento_id_veiculo_id/.test(e.message) ? "Esse carro já está nesse evento." : "Já existe um evento com esse nome.");
  if (e.code === "23514") return new ErroEvento(/reserva_fim|check/.test(e.message) ? "A data final não pode ser antes da inicial." : "Algum campo está inválido.");
  if (e.code === "23503") return new ErroEvento("O veículo ou o evento não existe mais.");
  if (e.code === "42501") return new ErroEvento("Sem permissão. Entre de novo na conta.");
  return new ErroEvento(e.message);
}
const COLUNAS_EVENTO = "id, nome, tipo, status, solicitante, comentarios, created_at";
const COLUNAS_RESERVA = "id, evento_id, veiculo_id, reserva_inicio, reserva_fim, estado, comentarios";

export async function listarEventos(): Promise<Evento[]> {
  const { data, error } = await supabase.from("eventos").select(COLUNAS_EVENTO).order("created_at", { ascending: false }).limit(2000);
  if (error) throw traduzir(error);
  return (data ?? []) as Evento[];
}
export async function listarReservas(): Promise<Reserva[]> {
  const { data, error } = await supabase.from("evento_veiculos").select(COLUNAS_RESERVA).order("reserva_inicio", { ascending: true }).limit(10000);
  if (error) throw traduzir(error);
  return (data ?? []) as Reserva[];
}
export async function criarEvento(e: EventoNovo): Promise<Evento> {
  const { data, error } = await supabase.from("eventos").insert({ ...e, nome: e.nome.trim() }).select(COLUNAS_EVENTO).single();
  if (error) throw traduzir(error);
  return data as Evento;
}
export async function atualizarEvento(id: string, patch: Partial<EventoNovo>): Promise<Evento> {
  const { data, error } = await supabase.from("eventos").update(patch).eq("id", id).select(COLUNAS_EVENTO).single();
  if (error) throw traduzir(error);
  return data as Evento;
}
export async function excluirEvento(id: string): Promise<void> {
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) throw traduzir(error);
}
/** Reserva vários carros de uma vez no mesmo período. Tudo ou nada. */
export async function reservarVeiculos(eventoId: string, veiculoIds: string[], inicio: string, fim: string, estado: EstadoReserva = "reservado"): Promise<Reserva[]> {
  if (veiculoIds.length === 0) return [];
  const { data, error } = await supabase.from("evento_veiculos").insert(veiculoIds.map((veiculo_id) => ({ evento_id: eventoId, veiculo_id, reserva_inicio: inicio, reserva_fim: fim, estado }))).select(COLUNAS_RESERVA);
  if (error) throw traduzir(error);
  return (data ?? []) as Reserva[];
}
export async function atualizarReserva(id: string, patch: Partial<Pick<Reserva, "reserva_inicio" | "reserva_fim" | "estado" | "comentarios">>): Promise<Reserva> {
  const { data, error } = await supabase.from("evento_veiculos").update(patch).eq("id", id).select(COLUNAS_RESERVA).single();
  if (error) throw traduzir(error);
  return data as Reserva;
}
export async function removerReserva(id: string): Promise<void> {
  const { error } = await supabase.from("evento_veiculos").delete().eq("id", id);
  if (error) throw traduzir(error);
}
