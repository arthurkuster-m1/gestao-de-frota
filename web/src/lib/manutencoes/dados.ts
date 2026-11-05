import { supabase } from "../supabase";
import type { Manutencao, ManutencaoNova } from "./tipos";

export class ErroManutencao extends Error {}
function traduzir(e: { code?: string; message: string }): ErroManutencao {
  if (/manutencoes/.test(e.message) && /schema cache|does not exist/.test(e.message)) return new ErroManutencao("As manutenções ainda não foram ativadas no banco (falta aplicar a migration 0008).");
  if (e.code === "23514") return new ErroManutencao(/_nome_check/.test(e.message) ? "O nome não pode ficar vazio." : /_status_check/.test(e.message) ? "O status é inválido." : /manutencoes_check|data_fim/.test(e.message) ? "O fim não pode ser antes do início." : "Algum campo está inválido.");
  if (e.code === "23503") return new ErroManutencao("O veículo não existe mais.");
  if (e.code === "42501") return new ErroManutencao("Sem permissão. Entre de novo na conta.");
  return new ErroManutencao(e.message);
}
const COLUNAS = "id, veiculo_id, nome, tipo, status, data_ocorrencia, data_da_solicitada, data_inicio, data_fim, bloqueia_uso, descricao, comentarios, created_at";

export async function listarManutencoes(): Promise<Manutencao[]> {
  const { data, error } = await supabase.from("manutencoes").select(COLUNAS).order("data_inicio", { ascending: false }).limit(5000);
  if (error) throw traduzir(error);
  return (data ?? []) as Manutencao[];
}
export async function criarManutencao(m: ManutencaoNova): Promise<Manutencao> {
  const limpa = Object.fromEntries(Object.entries({ ...m, nome: m.nome.trim() }).filter(([, v]) => v !== undefined && v !== ""));
  const { data, error } = await supabase.from("manutencoes").insert(limpa as never).select(COLUNAS).single();
  if (error) throw traduzir(error);
  return data as Manutencao;
}
export async function atualizarManutencao(id: string, patch: Partial<Omit<ManutencaoNova, "veiculo_id">>): Promise<Manutencao> {
  const { data, error } = await supabase.from("manutencoes").update(patch).eq("id", id).select(COLUNAS).single();
  if (error) throw traduzir(error);
  return data as Manutencao;
}
export async function excluirManutencao(id: string): Promise<void> {
  const { error } = await supabase.from("manutencoes").delete().eq("id", id);
  if (error) throw traduzir(error);
}
