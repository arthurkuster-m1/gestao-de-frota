import { supabase } from "../supabase";
import { lerDocumento, type Documento } from "./documento";

/** A página de planejamento de um evento (uma por evento; separada das páginas do menu Anotações). */
export async function abrirAnotacaoDoEvento(eventoId: string): Promise<Documento> {
  const { data, error } = await supabase.from("evento_anotacoes").select("blocks").eq("evento_id", eventoId).maybeSingle();
  if (error) throw traduzir(error);
  return lerDocumento((data as { blocks?: unknown } | null)?.blocks);
}

export async function gravarAnotacaoDoEvento(eventoId: string, blocks: Documento): Promise<void> {
  const { error } = await supabase.from("evento_anotacoes").upsert({ evento_id: eventoId, blocks } as never, { onConflict: "evento_id" });
  if (error) throw traduzir(error);
}

function traduzir(e: { code?: string; message: string }): Error {
  if (/evento_anotacoes/.test(e.message) && /schema cache|does not exist/.test(e.message)) return new Error("As anotações do evento ainda não foram ativadas no banco (falta rodar o SQL).");
  if (e.code === "23514") return new Error("A página ficou grande demais (máximo 400 KB de texto).");
  if (e.code === "42501") return new Error("Sem permissão. Entre de novo na conta.");
  return new Error(e.message);
}
