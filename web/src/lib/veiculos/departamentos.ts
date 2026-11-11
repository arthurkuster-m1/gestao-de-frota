import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "../supabase";
import { useVersaoDosDados } from "../sincronia";
import { DEPARTAMENTOS, DEPARTAMENTO_PADRAO } from "./tipos";

export class ErroDepartamento extends Error {}
const chave = (n: string) => n.trim().toLowerCase();
export type Departamento = { id?: string; nome: string };

/** Marketing sempre existe (é o padrão do banco); depois os do banco e, no fim, os de sempre que ainda não foram gravados. */
export function mesclarDepartamentos(linhas: readonly Departamento[], removidos: ReadonlySet<string> = new Set()): Departamento[] {
  const tem = new Set(linhas.map((l) => chave(l.nome)));
  const out: Departamento[] = [...linhas];
  for (const n of DEPARTAMENTOS) if (!tem.has(chave(n)) && !removidos.has(chave(n))) out.push({ nome: n });
  if (!out.some((d) => chave(d.nome) === chave(DEPARTAMENTO_PADRAO))) out.unshift({ nome: DEPARTAMENTO_PADRAO });
  return out.sort((a, b) => (chave(a.nome) === chave(DEPARTAMENTO_PADRAO) ? -1 : chave(b.nome) === chave(DEPARTAMENTO_PADRAO) ? 1 : 0));
}

let lista: Departamento[] = mesclarDepartamentos([]), carregadoPara = -1, iniciou = false;
const ouvintes = new Set<() => void>();
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
export const departamentosAtuais = () => lista;
const traduzir = (e: { code?: string; message: string }) => new ErroDepartamento(e.code === "23505" ? "Já existe um departamento com esse nome." : /departamentos/.test(e.message) && /schema cache|does not exist/.test(e.message) ? "Os departamentos ainda não foram ativados no banco (falta rodar o SQL)." : e.message);

async function carregar() {
  const { data, error } = await supabase.from("departamentos").select("id, nome, posicao").order("posicao", { ascending: true }).order("created_at", { ascending: true });
  if (error) lista = mesclarDepartamentos([]);
  else {
    // se já há linhas no banco, os de sempre só valem se também estiverem lá (assim apagar um de sempre funciona)
    const linhas = (data ?? []).map((r) => ({ id: r.id as string, nome: r.nome as string }));
    lista = mesclarDepartamentos(linhas, linhas.length > 0 ? new Set(DEPARTAMENTOS.map(chave)) : new Set());
  }
  ouvintes.forEach((f) => f());
}
/** Grava no banco os departamentos de sempre (para poderem ser renomeados ou apagados). */
async function materializar() {
  const faltam = lista.filter((d) => !d.id).map((d, i) => ({ nome: d.nome, posicao: 1000 + i }));
  if (faltam.length === 0) return;
  const { error } = await supabase.from("departamentos").insert(faltam as never);
  if (error) throw traduzir(error);
  await carregar();
}
export async function criarDepartamento(nome: string) {
  const n = nome.trim(); if (!n) throw new ErroDepartamento("Dê um nome ao departamento.");
  if (lista.some((d) => chave(d.nome) === chave(n))) throw new ErroDepartamento("Já existe um departamento com esse nome.");
  await materializar();
  const { error } = await supabase.from("departamentos").insert({ nome: n, posicao: 2000 + lista.length } as never);
  if (error) throw traduzir(error);
  await carregar();
}
export async function renomearDepartamento(d: Departamento, nome: string) {
  const n = nome.trim(); if (!n) throw new ErroDepartamento("O nome não pode ficar vazio.");
  if (chave(d.nome) === chave(DEPARTAMENTO_PADRAO)) throw new ErroDepartamento("Marketing é o departamento padrão e não pode ser renomeado.");
  if (lista.some((x) => chave(x.nome) === chave(n) && chave(x.nome) !== chave(d.nome))) throw new ErroDepartamento("Já existe um departamento com esse nome.");
  await materializar();
  const atual = lista.find((x) => chave(x.nome) === chave(d.nome)); if (!atual?.id) throw new ErroDepartamento("Departamento não encontrado.");
  const { error } = await supabase.from("departamentos").update({ nome: n } as never).eq("id", atual.id);
  if (error) throw traduzir(error);
  const r = await supabase.from("veiculos").update({ departamento: n } as never).eq("departamento", atual.nome);   // os carros do departamento vão junto
  if (r.error) throw traduzir(r.error);
  await carregar();
}
export async function excluirDepartamento(d: Departamento) {
  if (chave(d.nome) === chave(DEPARTAMENTO_PADRAO)) throw new ErroDepartamento("Marketing é o departamento padrão e não pode ser apagado.");
  await materializar();
  const atual = lista.find((x) => chave(x.nome) === chave(d.nome)); if (!atual?.id) return;
  const { error } = await supabase.from("departamentos").delete().eq("id", atual.id);
  if (error) throw traduzir(error);
  await carregar();
}
export function useDepartamentos() {
  const versao = useVersaoDosDados();
  useEffect(() => { if (carregadoPara !== versao || !iniciou) { carregadoPara = versao; iniciou = true; void carregar(); } }, [versao]);
  return useSyncExternalStore(assinar, () => lista);
}
