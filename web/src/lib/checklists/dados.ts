import { supabase } from "../supabase";
import type { Checklist, ChecklistNovo } from "./tipos";

export class ErroChecklist extends Error {}
function traduzir(e: { code?: string; message: string }): ErroChecklist {
  if (/checklists/.test(e.message) && /schema cache|does not exist/.test(e.message) && !/violates/.test(e.message)) return new ErroChecklist("Os checklists ainda não foram ativados no banco (falta aplicar a migration 0010).");
  if (/checklist_km_invalido/.test(e.message)) return new ErroChecklist("O km do retorno não pode ser menor que o da saída.");
  if (e.code === "23505") return new ErroChecklist("Esse checklist já foi feito para este carro. Edite o que já existe.");
  if (e.code === "23514") return new ErroChecklist(/avarias/.test(e.message) && /check/.test(e.message) ? "Se teve avarias, escreva quais." : "Algum valor está fora do permitido (km negativo, por exemplo).");
  if (e.code === "23503") return new ErroChecklist("A reserva não existe mais.");
  if (e.code === "42501") return new ErroChecklist("Sem permissão. Entre de novo na conta.");
  return new ErroChecklist(e.message);
}
const COLUNAS = "id, reserva_id, momento, data_hora, km, combustivel, limpeza, recebido_por, teve_avarias, avarias, observacoes, created_at";

export async function listarChecklists(): Promise<Checklist[]> {
  const { data, error } = await supabase.from("checklists").select(COLUNAS).order("data_hora", { ascending: false }).order("id", { ascending: true }).limit(10000);
  if (error) throw traduzir(error);
  return (data ?? []) as Checklist[];
}
export async function criarChecklist(c: ChecklistNovo): Promise<Checklist> {
  const { data, error } = await supabase.from("checklists").insert(c as never).select(COLUNAS).single();
  if (error) throw traduzir(error);
  return data as Checklist;
}
export async function atualizarChecklist(id: string, patch: Partial<Omit<ChecklistNovo, "reserva_id" | "momento">>): Promise<Checklist> {
  const { data, error } = await supabase.from("checklists").update(patch as never).eq("id", id).select(COLUNAS).single();
  if (error) throw traduzir(error);
  return data as Checklist;
}

/** Um checklist por reserva, todos de uma vez (a saída em massa de um evento). Tudo ou nada. */
export async function criarChecklistsEmMassa(reservaIds: string[], momento: ChecklistNovo["momento"], dados: Omit<ChecklistNovo, "reserva_id" | "momento" | "km">): Promise<Checklist[]> {
  if (reservaIds.length === 0) return [];
  const { data, error } = await supabase.from("checklists").insert(reservaIds.map((reserva_id) => ({ ...dados, km: null, reserva_id, momento })) as never).select(COLUNAS);
  if (error) throw traduzir(error);
  return (data ?? []) as Checklist[];
}
