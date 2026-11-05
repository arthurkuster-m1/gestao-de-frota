import { supabase } from "../supabase";
import type { Veiculo, VeiculoNovo } from "./tipos";

/** Erro com mensagem pronta para mostrar. */
export class ErroVeiculo extends Error {}

function traduzir(e: { code?: string; message: string; details?: string }): ErroVeiculo {
  if (e.code === "23505") {
    const onde = `${e.message} ${e.details ?? ""}`;
    if (onde.includes("vin")) return new ErroVeiculo("Já existe um veículo com esse VIN.");
    if (onde.includes("placa")) return new ErroVeiculo("Já existe um veículo com essa placa.");
    return new ErroVeiculo("Esse veículo já está cadastrado.");
  }
  if (e.code === "23514") return new ErroVeiculo("Algum campo está em formato inválido (VIN com 17 caracteres, placa com 7).");
  if (e.code === "42501") return new ErroVeiculo("Sem permissão. Entre de novo na conta.");
  return new ErroVeiculo(e.message);
}

export async function listarVeiculos(): Promise<Veiculo[]> {
  const { data, error } = await supabase.from("veiculos").select("*").order("created_at", { ascending: false }).limit(2000);
  if (error) throw traduzir(error);
  return (data ?? []) as Veiculo[];
}

export async function buscarVeiculo(id: string): Promise<Veiculo | null> {
  const { data, error } = await supabase.from("veiculos").select("*").eq("id", id).maybeSingle();
  if (error) throw traduzir(error);
  return (data as Veiculo | null) ?? null;
}

export async function criarVeiculo(v: VeiculoNovo): Promise<Veiculo> {
  const { data, error } = await supabase.from("veiculos").insert(v).select("*").single();
  if (error) throw traduzir(error);
  return data as Veiculo;
}

/** Tudo ou nada: se uma linha falhar, nenhuma é gravada (o banco recusa o lote inteiro). */
export async function criarVeiculos(vs: VeiculoNovo[]): Promise<number> {
  if (vs.length === 0) return 0;
  const { error } = await supabase.from("veiculos").insert(vs);
  if (error) throw traduzir(error);
  return vs.length;
}

/** Muda só alguns campos (edição no lugar, na tabela, nos cards, na linha do tempo). Devolve a linha inteira atualizada (o código é recalculado pelo banco). */
export async function atualizarCampos(id: string, patch: Partial<VeiculoNovo>): Promise<Veiculo> {
  const { data, error } = await supabase.from("veiculos").update(patch).eq("id", id).select("*").single();
  if (error) throw traduzir(error);
  return data as Veiculo;
}

export async function atualizarVeiculo(id: string, v: VeiculoNovo): Promise<Veiculo> {
  const { data, error } = await supabase.from("veiculos").update(v).eq("id", id).select("*").single();
  if (error) throw traduzir(error);
  return data as Veiculo;
}

export type Atividade = { id: string; tipo: string; ocorreu_em: string; descricao: string };
export async function listarAtividades(veiculoId: string): Promise<Atividade[]> {
  const { data, error } = await supabase.from("veiculo_atividades").select("id, tipo, ocorreu_em, descricao").eq("veiculo_id", veiculoId).order("ocorreu_em", { ascending: false }).limit(200);
  if (error) throw traduzir(error);
  return (data ?? []) as Atividade[];
}
