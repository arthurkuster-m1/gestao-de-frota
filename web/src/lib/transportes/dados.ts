import { supabase } from "../supabase";
import { colunaDoSentido, paraNumero } from "./regras";
import type { Pagamento, PagamentoNovo, Sentido, Transporte, TransporteNovo, VinculoDaReserva } from "./tipos";

export class ErroTransporte extends Error {}
function traduzir(e: { code?: string; message: string }): ErroTransporte {
  if (/transportes|pagamentos|transporte_ida_id/.test(e.message) && /schema cache|does not exist|column/.test(e.message) && !/violates/.test(e.message)) return new ErroTransporte("Transportes e pagamentos ainda não foram ativados no banco (falta aplicar a migration 0009).");
  if (/transporte_pagamento_incompativel/.test(e.message)) return new ErroTransporte("PTA se liga a pagamento de PTA, e TSO a NF da TSO. Retirada não tem pagamento.");
  if (/reserva_transporte_invalido/.test(e.message)) return new ErroTransporte("Esse transporte não é do mesmo evento ou não é do sentido certo.");
  if (e.code === "23505") return new ErroTransporte("Já existe um pagamento desse tipo com esse número.");
  if (e.code === "23514") return new ErroTransporte(/pagamentos_check|status/.test(e.message) ? "Esse status não existe para esse tipo de pagamento." : /_check/.test(e.message) ? "Algum valor está fora do permitido (valores não podem ser negativos, km até 20.000, dias até 60)." : "Algum campo está inválido.");
  if (e.code === "23503") return new ErroTransporte("O evento, o transporte ou o pagamento não existe mais.");
  if (e.code === "42501") return new ErroTransporte("Sem permissão. Entre de novo na conta.");
  return new ErroTransporte(e.message);
}
const COL_T = "id, evento_id, sentido, modalidade, distancia_km, dias_viagem, referencia, transportadora, valor_planejado, pagamento_id, comentarios, created_at";
const COL_P = "id, tipo, numero, status, valor_planejado, valor_real, data_pagamento, departamento, comentarios, created_at";
const NUMERICOS = new Set(["distancia_km", "dias_viagem", "valor_planejado", "valor_real"]);

/** O editor da tabela entrega texto ("1.234,56"): aqui vira número antes de ir ao banco. */
function arrumar<T extends Record<string, unknown>>(patch: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) out[k] = NUMERICOS.has(k) && typeof v === "string" ? paraNumero(v) : v;
  return out as T;
}

export async function listarTransportes(): Promise<Transporte[]> {
  const { data, error } = await supabase.from("transportes").select(COL_T).order("created_at", { ascending: false }).limit(5000);
  if (error) throw traduzir(error);
  return (data ?? []) as Transporte[];
}
export async function criarTransporte(t: TransporteNovo): Promise<Transporte> {
  const { data, error } = await supabase.from("transportes").insert(arrumar(t) as never).select(COL_T).single();
  if (error) throw traduzir(error);
  return data as Transporte;
}
export async function atualizarTransporte(id: string, patch: Partial<Omit<TransporteNovo, "evento_id">>): Promise<Transporte> {
  const { data, error } = await supabase.from("transportes").update(arrumar(patch) as never).eq("id", id).select(COL_T).single();
  if (error) throw traduzir(error);
  return data as Transporte;
}
export async function excluirTransporte(id: string): Promise<void> {
  const { error } = await supabase.from("transportes").delete().eq("id", id);
  if (error) throw traduzir(error);
}

export async function listarPagamentos(): Promise<Pagamento[]> {
  const { data, error } = await supabase.from("pagamentos").select(COL_P).order("created_at", { ascending: false }).limit(5000);
  if (error) throw traduzir(error);
  return (data ?? []) as Pagamento[];
}
export async function criarPagamento(p: PagamentoNovo): Promise<Pagamento> {
  const { data, error } = await supabase.from("pagamentos").insert(arrumar({ ...p, numero: p.numero.trim() }) as never).select(COL_P).single();
  if (error) throw traduzir(error);
  return data as Pagamento;
}
export async function atualizarPagamento(id: string, patch: Partial<PagamentoNovo>): Promise<Pagamento> {
  const { data, error } = await supabase.from("pagamentos").update(arrumar(patch) as never).eq("id", id).select(COL_P).single();
  if (error) throw traduzir(error);
  return data as Pagamento;
}
export async function excluirPagamento(id: string): Promise<void> {
  const { error } = await supabase.from("pagamentos").delete().eq("id", id);
  if (error) throw traduzir(error);
}

/** Qual transporte cada reserva usa. Separado da lista de reservas para o resto do app não depender da migration 0009. */
export async function listarVinculos(): Promise<VinculoDaReserva[]> {
  const { data, error } = await supabase.from("evento_veiculos").select("id, transporte_ida_id, transporte_volta_id").limit(10000);
  if (error) throw traduzir(error);
  return (data ?? []) as VinculoDaReserva[];
}
/** Põe (ou tira, com null) o transporte de ida ou de volta de várias reservas de uma vez. */
export async function definirTransporteDasReservas(reservaIds: string[], sentido: Sentido, transporteId: string | null): Promise<VinculoDaReserva[]> {
  if (reservaIds.length === 0) return [];
  const { data, error } = await supabase.from("evento_veiculos").update({ [colunaDoSentido(sentido)]: transporteId }).in("id", reservaIds).select("id, transporte_ida_id, transporte_volta_id");
  if (error) throw traduzir(error);
  return (data ?? []) as VinculoDaReserva[];
}
