import { supabase } from "../supabase";
import { camposDeBusca, termoDeBusca } from "./busca";
import { lerDocumento, type Documento } from "./documento";
import { COLUNAS_DA_NOTA, COLUNAS_DO_RESUMO, type NotaAberta, type ResumoDaNota } from "./paginas";

export class ErroNota extends Error {}
function traduzir(e: { code?: string; message: string }): ErroNota {
  if (/notes_pages|notes_user_state/.test(e.message) && /schema cache|does not exist/.test(e.message) && !/violates/.test(e.message)) return new ErroNota("As anotações ainda não foram ativadas no banco (falta rodar o SQL).");
  if (/subpáginas demais/.test(e.message)) return new ErroNota("Subpáginas demais, uma dentro da outra (máximo 12 níveis).");
  if (/dentro dela mesma/.test(e.message)) return new ErroNota("Uma página não pode ficar dentro dela mesma.");
  if (e.code === "23514" && /blocks/.test(e.message)) return new ErroNota("A página ficou grande demais (máximo 400 KB de texto).");
  if (e.code === "42501") return new ErroNota("Sem permissão. Entre de novo na conta.");
  return new ErroNota(e.message);
}

const comoResumo = (r: unknown) => r as ResumoDaNota;

/** Todas as páginas (sem o conteúdo), lixeira incluída: a lateral e a lixeira saem daqui. */
export async function listarNotas(): Promise<ResumoDaNota[]> {
  const { data, error } = await supabase.from("notes_pages").select(COLUNAS_DO_RESUMO).order("position", { ascending: true }).order("id", { ascending: true }).limit(5000);
  if (error) throw traduzir(error);
  return (data ?? []).map((r) => ({ ...comoResumo(r), position: Number((r as { position: unknown }).position) }));
}
export async function abrirNota(id: string): Promise<NotaAberta | null> {
  const { data, error } = await supabase.from("notes_pages").select(COLUNAS_DA_NOTA).eq("id", id).maybeSingle();
  if (error) throw traduzir(error);
  if (!data) return null;
  const r = data as unknown as ResumoDaNota & { blocks: unknown };
  return { ...r, position: Number(r.position), blocks: lerDocumento(r.blocks) };
}
export async function criarNota(n: { parent_id: string | null; title?: string; position: number; blocks?: Documento }): Promise<ResumoDaNota> {
  const title = (n.title ?? "").trim();
  const campos = camposDeBusca(title, n.blocks ?? []);
  const { data, error } = await supabase.from("notes_pages").insert({ parent_id: n.parent_id, title, position: n.position, blocks: n.blocks ?? [], ...campos } as never).select(COLUNAS_DO_RESUMO).single();
  if (error) throw traduzir(error);
  return { ...comoResumo(data), position: Number((data as { position: unknown }).position) };
}
/** Muda título, ícone, lugar ou conteúdo. Título ou conteúdo novos atualizam também os campos de busca (sem acento). */
export async function editarNota(id: string, patch: { title?: string; icon?: string | null; blocks?: Documento; parent_id?: string | null; position?: number }, atual?: { title: string; blocks: Documento }): Promise<ResumoDaNota> {
  const corpo: Record<string, unknown> = { ...patch };
  if (patch.title !== undefined) corpo.title = patch.title.trim();
  if (patch.title !== undefined || patch.blocks !== undefined) {
    const titulo = (patch.title ?? atual?.title ?? "").trim(), blocos = patch.blocks ?? atual?.blocks ?? [];
    Object.assign(corpo, camposDeBusca(titulo, blocos));
  }
  const { data, error } = await supabase.from("notes_pages").update(corpo as never).eq("id", id).select(COLUNAS_DO_RESUMO).single();
  if (error) throw traduzir(error);
  return { ...comoResumo(data), position: Number((data as { position: unknown }).position) };
}
/** Manda a página (e as de dentro) para a lixeira, todas no MESMO instante. */
export async function moverParaLixeira(ids: string[], instante: string): Promise<void> {
  const { error } = await supabase.from("notes_pages").update({ deleted_at: instante } as never).in("id", ids);
  if (error) throw traduzir(error);
}
export async function restaurarNotas(ids: string[], paraARaiz: string | null | undefined): Promise<void> {
  const { error } = await supabase.from("notes_pages").update({ deleted_at: null } as never).in("id", ids);
  if (error) throw traduzir(error);
  if (paraARaiz !== undefined && ids[0]) { const r = await supabase.from("notes_pages").update({ parent_id: paraARaiz } as never).eq("id", ids[0]); if (r.error) throw traduzir(r.error); }
}
/** Apagar de vez: só vale para o que já está na lixeira. */
export async function apagarDeVez(id: string): Promise<void> {
  const { error } = await supabase.from("notes_pages").delete().eq("id", id).not("deleted_at", "is", null);
  if (error) throw traduzir(error);
}

// ---- estado de cada pessoa: favorita e último acesso
export type EstadoDaNota = { page_id: string; favorite: boolean; last_opened_at: string | null };
export async function listarEstado(): Promise<EstadoDaNota[]> {
  const { data, error } = await supabase.from("notes_user_state").select("page_id, favorite, last_opened_at").limit(5000);
  if (error) throw traduzir(error);
  return (data ?? []) as EstadoDaNota[];
}
export async function definirFavorita(pageId: string, favorite: boolean): Promise<void> {
  const { error } = await supabase.from("notes_user_state").upsert({ page_id: pageId, favorite } as never, { onConflict: "user_id,page_id" });
  if (error) throw traduzir(error);
}
export async function registrarAbertura(pageId: string): Promise<void> {
  const { error } = await supabase.from("notes_user_state").upsert({ page_id: pageId, last_opened_at: new Date().toISOString() } as never, { onConflict: "user_id,page_id" });
  if (error) throw traduzir(error);
}

// ---- busca (sem acento): o termo é dobrado aqui e comparado com as colunas dobradas ao gravar
export type ResultadoDeBusca = { id: string; title: string; icon: string | null; search_text: string };
export async function buscarNotas(bruto: string): Promise<ResultadoDeBusca[]> {
  const termo = termoDeBusca(bruto); if (termo.length < 2) return [];
  const { data, error } = await supabase.from("notes_pages").select("id, title, icon, search_text").is("deleted_at", null).or(`title_fold.ilike.%${termo}%,search_fold.ilike.%${termo}%`).limit(30);
  if (error) throw traduzir(error);
  return (data ?? []) as ResultadoDeBusca[];
}
