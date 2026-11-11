import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { PreferenciasDaTabela } from "./layout";
import { visaoDaLinha, type TipoDeVisualizacao, type VisaoSalva } from "./visoes";

export class ErroVisao extends Error {}
const traduzir = (e: { code?: string; message: string }) =>
  new ErroVisao(/visoes_salvas/.test(e.message) && /schema cache|does not exist/.test(e.message) ? "As visualizações salvas ainda não foram ativadas no banco (falta aplicar a migration 0004)." : e.code === "23505" ? "Já existe uma visualização com esse nome." : e.code === "23514" ? "Nome ou configuração inválidos." : e.message);
const COLUNAS = "id, tela, nome, tipo, config, posicao";

/** As visualizações salvas de uma tela (as abas). São do espaço de trabalho: quem é membro vê e edita as mesmas. */
export function useVisoes(tela: string) {
  const [visoes, setVisoes] = useState<VisaoSalva[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("visoes_salvas").select(COLUNAS).eq("tela", tela).order("posicao", { ascending: true }).order("created_at", { ascending: true });
    if (error) { setErro(traduzir(error).message); setCarregando(false); return; }
    setErro(null); setVisoes((data ?? []).map((l) => visaoDaLinha(l as never))); setCarregando(false);
  }, [tela]);
  useEffect(() => { void carregar(); }, [carregar]);

  const criar = async (nome: string, tipo: TipoDeVisualizacao, config: PreferenciasDaTabela): Promise<VisaoSalva> => {
    const posicao = visoes.reduce((m, v) => Math.max(m, v.posicao), 0) + 1;
    const { data, error } = await supabase.from("visoes_salvas").insert({ tela, nome: nome.trim(), tipo, config, posicao }).select(COLUNAS).single();
    if (error) throw traduzir(error);
    const v = visaoDaLinha(data as never); setVisoes((l) => [...l, v]); return v;
  };
  const atualizar = async (id: string, patch: { nome?: string; config?: PreferenciasDaTabela; tipo?: TipoDeVisualizacao }) => {
    const { data, error } = await supabase.from("visoes_salvas").update(patch).eq("id", id).select(COLUNAS).single();
    if (error) throw traduzir(error);
    const v = visaoDaLinha(data as never); setVisoes((l) => l.map((x) => (x.id === id ? v : x))); return v;
  };
  /** Grava a "Todas": consulta o banco (não o estado da tela, que pode estar defasado) e atualiza a linha reservada; só cria se não existir. */
  const salvarPadrao = async (nome: string, tipo: TipoDeVisualizacao, config: PreferenciasDaTabela): Promise<VisaoSalva> => {
    const { data: achada, error: e1 } = await supabase.from("visoes_salvas").select("id").eq("tela", tela).eq("nome", nome).maybeSingle();
    if (e1) throw traduzir(e1);
    if (achada) {
      const { data, error } = await supabase.from("visoes_salvas").update({ config, tipo }).eq("id", achada.id).select(COLUNAS).single();
      if (error) throw traduzir(error);
      const v = visaoDaLinha(data as never); setVisoes((l) => (l.some((x) => x.id === v.id) ? l.map((x) => (x.id === v.id ? v : x)) : [...l, v])); return v;
    }
    return criar(nome, tipo, config);
  };
  const excluir = async (id: string) => {
    const { error } = await supabase.from("visoes_salvas").delete().eq("id", id);
    if (error) throw traduzir(error);
    setVisoes((l) => l.filter((x) => x.id !== id));
  };
  /** Muda a ordem das abas: `ids` são as abas visíveis na nova ordem (as linhas reservadas ficam onde estão). */
  const reordenar = async (ids: string[]) => {
    const antes = visoes;
    const ordem = new Map(ids.map((id, i) => [id, i + 1]));
    setVisoes((l) => [...l.filter((x) => !ordem.has(x.id)), ...ids.map((id) => l.find((x) => x.id === id)!).filter(Boolean).map((x, i) => ({ ...x, posicao: i + 1 }))]);
    const resultados = await Promise.all(ids.map((id, i) => supabase.from("visoes_salvas").update({ posicao: i + 1 }).eq("id", id)));
    const falhou = resultados.find((r) => r.error);
    if (falhou?.error) { setVisoes(antes); throw traduzir(falhou.error); }
  };
  return { visoes, carregando, erro, criar, atualizar, salvarPadrao, excluir, reordenar, recarregar: carregar };
}
