import { useSyncExternalStore } from "react";
import { supabase } from "../supabase";

/** As cores das tags de opção (status etc.), no estilo do Notion. */
export const PALETA = [
  { id: "cinza", nome: "Cinza" }, { id: "marrom", nome: "Marrom" }, { id: "laranja", nome: "Laranja" },
  { id: "amarelo", nome: "Amarelo" }, { id: "verde", nome: "Verde" }, { id: "azul", nome: "Azul" },
  { id: "roxo", nome: "Roxo" }, { id: "rosa", nome: "Rosa" }, { id: "vermelho", nome: "Vermelho" },
] as const;
export type CorDaTag = (typeof PALETA)[number]["id"];
const IDS = new Set<string>(PALETA.map((c) => c.id));

/** Cor de fábrica de cada "tom" que as telas já declaram. */
export const COR_DO_TOM: Record<string, CorDaTag> = { success: "verde", warning: "amarelo", error: "vermelho", info: "azul", accent: "roxo", neutral: "cinza" };

/** As escolhas ficam no banco (tabela de visualizações salvas, tela reservada), do espaço de trabalho: valem em qualquer aparelho. */
const TELA = "cores-opcoes";
type Mapa = Record<string, Record<string, CorDaTag>>;
let mapa: Mapa = {};
let carregado = false;
const ouvintes = new Set<() => void>();
const avisa = () => ouvintes.forEach((f) => f());

async function carregar() {
  carregado = true;
  const { data, error } = await supabase.from("visoes_salvas").select("nome, config").eq("tela", TELA);
  if (error) return; // sem banco/migration: ficam as cores de fábrica
  const novo: Mapa = {};
  for (const l of data ?? []) {
    const cfg = (l.config ?? {}) as Record<string, unknown>;
    const m: Record<string, CorDaTag> = {};
    for (const [k, v] of Object.entries(cfg)) if (typeof v === "string" && IDS.has(v)) m[k] = v as CorDaTag;
    novo[l.nome] = m;
  }
  mapa = novo; avisa();
}

export function useCores() {
  const snap = useSyncExternalStore((f) => { ouvintes.add(f); if (!carregado) void carregar(); return () => { ouvintes.delete(f); }; }, () => mapa);
  return snap;
}

export const corDaOpcao = (m: Mapa, campoId: string | undefined, valor: string, tom?: string): CorDaTag =>
  (campoId ? m[campoId]?.[valor] : undefined) ?? (tom ? COR_DO_TOM[tom] : undefined) ?? "cinza";

/** Grava a cor de uma opção (null = volta à de fábrica). Atualiza a tela na hora e desfaz se o banco recusar. */
export async function salvarCor(campoId: string, valor: string, cor: CorDaTag | null) {
  const antes = mapa;
  const atual = { ...(mapa[campoId] ?? {}) };
  if (cor) atual[valor] = cor; else delete atual[valor];
  mapa = { ...mapa, [campoId]: atual }; avisa();
  const { data: achada, error: e1 } = await supabase.from("visoes_salvas").select("id").eq("tela", TELA).eq("nome", campoId).maybeSingle();
  const r = e1 ? { error: e1 } : achada
    ? await supabase.from("visoes_salvas").update({ config: atual }).eq("id", achada.id)
    : await supabase.from("visoes_salvas").insert({ tela: TELA, nome: campoId, tipo: "tabela", config: atual, posicao: 0 });
  if (r.error) { mapa = antes; avisa(); throw new Error(r.error.message); }
}
