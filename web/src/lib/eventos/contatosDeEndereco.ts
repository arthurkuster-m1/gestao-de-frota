import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "../supabase";
import { useVersaoDosDados } from "../sincronia";

/** O mesmo endereço (sem diferenciar maiúsculas nem espaços repetidos) é a mesma chave. */
export const chaveDoEndereco = (e: string | null | undefined) => (e ?? "").trim().toLowerCase().replace(/\s+/g, " ");

let mapa = new Map<string, string>(), carregadoPara = -1, iniciou = false;
const ouvintes = new Set<() => void>();
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
/** O contato lembrado de um endereço (ou null). Funciona fora de componentes. */
export const contatoDoEndereco = (endereco: string | null | undefined): string | null => mapa.get(chaveDoEndereco(endereco)) ?? null;

async function carregar() {
  const { data, error } = await supabase.from("contatos_de_endereco").select("endereco, contato");
  mapa = error ? new Map() : new Map((data ?? []).map((r) => [chaveDoEndereco(r.endereco as string), r.contato as string]));   // sem a tabela (SQL ainda não rodou): nada é lembrado
  ouvintes.forEach((f) => f());
}
/** Lembra o contato daquele endereço: da próxima vez que o endereço aparecer, o contato vem junto. Nunca atrapalha quem chamou (falha em silêncio). */
export async function lembrarContato(endereco: string | null | undefined, contato: string | null | undefined): Promise<void> {
  const e = (endereco ?? "").trim().replace(/\s+/g, " "), c = (contato ?? "").trim();
  if (!e || !c || contatoDoEndereco(e) === c) return;
  mapa = new Map(mapa).set(chaveDoEndereco(e), c); ouvintes.forEach((f) => f());
  // o índice único é por expressão (sem diferenciar maiúsculas): procura o endereço e atualiza, ou cria
  const achados = await supabase.from("contatos_de_endereco").select("id, endereco");
  if (achados.error) return;
  const id = (achados.data ?? []).find((r) => chaveDoEndereco(r.endereco as string) === chaveDoEndereco(e))?.id as string | undefined;
  if (id) await supabase.from("contatos_de_endereco").update({ contato: c } as never).eq("id", id);
  else await supabase.from("contatos_de_endereco").insert({ endereco: e, contato: c } as never);
}
export function useContatosDeEndereco() {
  const versao = useVersaoDosDados();
  useEffect(() => { if (carregadoPara !== versao || !iniciou) { carregadoPara = versao; iniciou = true; void carregar(); } }, [versao]);
  useSyncExternalStore(assinar, () => mapa);
  return { contatoDe: contatoDoEndereco };
}
