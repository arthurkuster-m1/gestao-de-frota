import { supabase } from "../supabase";
import type { Aditivo, AditivoNovo, AditivoVeiculo, Contrato, ContratoNovo, ContratoVeiculo } from "./tipos";

export class ErroContrato extends Error {}
function traduzir(e: { code?: string; message: string }): ErroContrato {
  if (/contratos_comodato|contrato_aditivos|contrato_veiculos/.test(e.message) && /schema cache|does not exist/.test(e.message) && !/violates/.test(e.message)) return new ErroContrato("Os contratos ainda não foram ativados no banco (falta aplicar a migration 0011).");
  if (e.code === "23505") return new ErroContrato(/contratos_evento_uidx/.test(e.message) ? "Esse evento já tem contrato. O que mudar depois entra como aditivo." : "Esse carro já está no contrato.");
  if (e.code === "23514") return new ErroContrato(/vigencia|check/.test(e.message) && !/extensao/.test(e.message) ? "O fim da vigência não pode ser antes do início." : "A extensão de prazo precisa da nova data de fim.");
  if (e.code === "23503") return new ErroContrato(/delete|still referenced/.test(e.message) ? "Não dá para apagar: o evento ou o cliente tem contrato." : "O evento, o cliente ou o carro não existe mais.");
  if (e.code === "42501") return new ErroContrato("Sem permissão. Entre de novo na conta.");
  return new ErroContrato(e.message);
}
const COL_C = "id, evento_id, cliente_id, status, vigencia_inicio, vigencia_fim, assinado_em, observacoes, created_at";
const COL_A = "id, contrato_id, tipo, status, motivo, vigencia_fim_anterior, vigencia_fim_nova, assinado_em, created_at";

export async function listarContratos(): Promise<Contrato[]> { const { data, error } = await supabase.from("contratos_comodato").select(COL_C).order("created_at", { ascending: false }).order("id", { ascending: true }).limit(5000); if (error) throw traduzir(error); return (data ?? []) as Contrato[]; }
export async function listarCarrosDosContratos(): Promise<ContratoVeiculo[]> { const { data, error } = await supabase.from("contrato_veiculos").select("id, contrato_id, veiculo_id").limit(20000); if (error) throw traduzir(error); return (data ?? []) as ContratoVeiculo[]; }
export async function listarAditivos(): Promise<Aditivo[]> { const { data, error } = await supabase.from("contrato_aditivos").select(COL_A).order("created_at", { ascending: true }).order("id", { ascending: true }).limit(5000); if (error) throw traduzir(error); return (data ?? []) as Aditivo[]; }
export async function listarCarrosDosAditivos(): Promise<AditivoVeiculo[]> { const { data, error } = await supabase.from("contrato_aditivo_veiculos").select("id, aditivo_id, veiculo_id, acao").limit(20000); if (error) throw traduzir(error); return (data ?? []) as AditivoVeiculo[]; }

export async function criarContrato(c: ContratoNovo, veiculoIds: string[]): Promise<{ contrato: Contrato; carros: ContratoVeiculo[] }> {
  const { data, error } = await supabase.from("contratos_comodato").insert(c as never).select(COL_C).single();
  if (error) throw traduzir(error);
  const contrato = data as Contrato;
  if (!veiculoIds.length) return { contrato, carros: [] };
  const r = await supabase.from("contrato_veiculos").insert(veiculoIds.map((veiculo_id) => ({ contrato_id: contrato.id, veiculo_id })) as never).select("id, contrato_id, veiculo_id");
  if (r.error) throw new ErroContrato(`Contrato criado, mas os carros não foram ligados: ${traduzir(r.error).message}`);
  return { contrato, carros: (r.data ?? []) as ContratoVeiculo[] };
}
export async function atualizarContrato(id: string, patch: Partial<Omit<ContratoNovo, "evento_id">>): Promise<Contrato> { const { data, error } = await supabase.from("contratos_comodato").update(patch as never).eq("id", id).select(COL_C).single(); if (error) throw traduzir(error); return data as Contrato; }
export async function excluirContrato(id: string): Promise<void> { const { error } = await supabase.from("contratos_comodato").delete().eq("id", id); if (error) throw traduzir(error); }
export async function adicionarCarroAoContrato(contratoId: string, veiculoId: string): Promise<ContratoVeiculo> { const { data, error } = await supabase.from("contrato_veiculos").insert({ contrato_id: contratoId, veiculo_id: veiculoId } as never).select("id, contrato_id, veiculo_id").single(); if (error) throw traduzir(error); return data as ContratoVeiculo; }
export async function tirarCarroDoContrato(id: string): Promise<void> { const { error } = await supabase.from("contrato_veiculos").delete().eq("id", id); if (error) throw traduzir(error); }

export async function criarAditivo(a: AditivoNovo, itens: { veiculo_id: string; acao: "sai" | "entra" }[]): Promise<{ aditivo: Aditivo; itens: AditivoVeiculo[] }> {
  const { data, error } = await supabase.from("contrato_aditivos").insert(a as never).select(COL_A).single();
  if (error) throw traduzir(error);
  const aditivo = data as Aditivo;
  if (!itens.length) return { aditivo, itens: [] };
  const r = await supabase.from("contrato_aditivo_veiculos").insert(itens.map((i) => ({ ...i, aditivo_id: aditivo.id })) as never).select("id, aditivo_id, veiculo_id, acao");
  if (r.error) throw new ErroContrato(`Aditivo criado, mas os carros não foram ligados: ${traduzir(r.error).message}`);
  return { aditivo, itens: (r.data ?? []) as AditivoVeiculo[] };
}
export async function atualizarAditivo(id: string, patch: Partial<Pick<Aditivo, "status" | "motivo" | "vigencia_fim_nova" | "assinado_em">>): Promise<Aditivo> { const { data, error } = await supabase.from("contrato_aditivos").update(patch as never).eq("id", id).select(COL_A).single(); if (error) throw traduzir(error); return data as Aditivo; }
export async function excluirAditivo(id: string): Promise<void> { const { error } = await supabase.from("contrato_aditivos").delete().eq("id", id); if (error) throw traduzir(error); }
