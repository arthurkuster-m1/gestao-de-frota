import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "../supabase";
import { useVersaoDosDados } from "../sincronia";
import { TIPOS_EVENTO } from "./tipos";

/** Tipo de evento: o nome e se os carros VOLTAM (alguns eventos não têm retorno: os carros ficam). */
export type TipoDeEvento = { id?: string; nome: string; semRetorno: boolean };
export class ErroTipo extends Error {}
const chave = (n: string) => n.trim().toLowerCase();

/** Os tipos de sempre (do app) + os do banco. Tipo do banco com o mesmo nome de um de sempre vale no lugar dele. */
export function mesclarTipos(linhas: readonly TipoDeEvento[]): TipoDeEvento[] {
  const doBanco = new Map(linhas.map((l) => [chave(l.nome), l]));
  const out: TipoDeEvento[] = [...linhas];
  for (const n of TIPOS_EVENTO) if (!doBanco.has(chave(n))) out.push({ nome: n, semRetorno: false });
  return out;
}

let tipos: TipoDeEvento[] = mesclarTipos([]), carregadoPara = -1, versaoDoBanco = 0;
const ouvintes = new Set<() => void>();
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
const avisar = () => ouvintes.forEach((f) => f());
/** Os tipos de agora (para quem monta listas fora de um componente). */
export const tiposAtuais = () => tipos;
export const eventoSemRetorno = (tipo: string | null | undefined, lista: readonly TipoDeEvento[] = tipos) => !!tipo && lista.some((t) => chave(t.nome) === chave(tipo) && t.semRetorno);

async function carregar() {
  const { data, error } = await supabase.from("tipos_de_evento").select("id, nome, sem_retorno, posicao").order("posicao", { ascending: true }).order("created_at", { ascending: true });
  // sem a tabela (SQL ainda não rodou) valem só os tipos de sempre
  tipos = error ? mesclarTipos([]) : mesclarTipos((data ?? []).map((r) => ({ id: r.id as string, nome: r.nome as string, semRetorno: !!r.sem_retorno })));
  avisar();
}
const traduzir = (e: { code?: string; message: string }) => new ErroTipo(e.code === "23505" ? "Já existe um tipo com esse nome." : /tipos_de_evento/.test(e.message) && /schema cache|does not exist/.test(e.message) ? "Os tipos de evento ainda não foram ativados no banco (falta rodar o SQL)." : e.message);

/** Grava no banco os tipos de sempre que ainda só existem no app (para poderem ser renomeados, ajustados ou apagados). */
async function materializar() {
  const faltam = tipos.filter((t) => !t.id).map((t, i) => ({ nome: t.nome, sem_retorno: t.semRetorno, posicao: 1000 + i }));
  if (faltam.length === 0) return;
  const { error } = await supabase.from("tipos_de_evento").insert(faltam as never);
  if (error) throw traduzir(error);
  await carregar();
}
export async function criarTipo(nome: string, semRetorno: boolean) {
  const n = nome.trim(); if (!n) throw new ErroTipo("Dê um nome ao tipo.");
  if (tipos.some((t) => chave(t.nome) === chave(n))) throw new ErroTipo("Já existe um tipo com esse nome.");
  const { error } = await supabase.from("tipos_de_evento").insert({ nome: n, sem_retorno: semRetorno, posicao: tipos.length + 1000 } as never);
  if (error) throw traduzir(error);
  await carregar();
}
/** Muda o nome e/ou "os carros não voltam". Renomear leva junto os eventos que já usam o tipo. */
export async function atualizarTipo(t: TipoDeEvento, patch: { nome?: string; semRetorno?: boolean }) {
  await materializar();
  const atual = tipos.find((x) => chave(x.nome) === chave(t.nome)); if (!atual?.id) throw new ErroTipo("Tipo não encontrado.");
  const nome = patch.nome?.trim();
  if (nome !== undefined && !nome) throw new ErroTipo("O nome não pode ficar vazio.");
  if (nome && chave(nome) !== chave(atual.nome) && tipos.some((x) => chave(x.nome) === chave(nome))) throw new ErroTipo("Já existe um tipo com esse nome.");
  const { error } = await supabase.from("tipos_de_evento").update({ ...(nome !== undefined ? { nome } : {}), ...(patch.semRetorno !== undefined ? { sem_retorno: patch.semRetorno } : {}) } as never).eq("id", atual.id);
  if (error) throw traduzir(error);
  if (nome && nome !== atual.nome) { const r = await supabase.from("eventos").update({ tipo: nome } as never).eq("tipo", atual.nome); if (r.error) throw traduzir(r.error); }
  await carregar();
}
/** Apaga o tipo da lista. Os eventos que já têm esse tipo continuam com o nome dele escrito. */
export async function excluirTipo(t: TipoDeEvento) {
  await materializar();
  const atual = tipos.find((x) => chave(x.nome) === chave(t.nome)); if (!atual?.id) return;
  const { error } = await supabase.from("tipos_de_evento").delete().eq("id", atual.id);
  if (error) throw traduzir(error);
  await carregar();
}

/** Os tipos de evento (carregados uma vez para o app todo). */
export function useTiposDeEvento() {
  const versao = useVersaoDosDados();
  useEffect(() => { if (carregadoPara !== versao || versaoDoBanco === 0) { carregadoPara = versao; versaoDoBanco = 1; void carregar(); } }, [versao]);
  const lista = useSyncExternalStore(assinar, () => tipos);
  return { tipos: lista, semRetorno: (tipo: string | null | undefined) => eventoSemRetorno(tipo, lista) };
}
