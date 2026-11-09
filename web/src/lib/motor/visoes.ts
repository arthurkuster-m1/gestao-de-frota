import { z } from "zod";
import { preferenciasDaTabelaSchema, type PreferenciasDaTabela } from "./layout";

/** Tipos de visualização (as "abas"). Valores = CHECK da migration 0004. Tabela já existe; as outras vêm nas próximas entregas. */
export const TIPOS_DE_VISUALIZACAO = ["tabela", "kanban", "calendario", "timeline", "galeria"] as const;
export type TipoDeVisualizacao = (typeof TIPOS_DE_VISUALIZACAO)[number];
export const ROTULO_DO_TIPO: Record<TipoDeVisualizacao, string> = { tabela: "Tabela", kanban: "Quadro", calendario: "Calendário", timeline: "Linha do tempo", galeria: "Cards" };

export const MAXIMO_DE_VISUALIZACOES = 30;
/** Nome reservado da linha que guarda a visualização "Todas" (escondida das abas). */
export const NOME_DA_VISAO_PADRAO = "__todas__";

/** Uma linha de `visoes_salvas`, já com a config validada. */
export type VisaoSalva = { id: string; tela: string; nome: string; tipo: TipoDeVisualizacao; config: PreferenciasDaTabela; posicao: number };

/** Config lida do banco que já não passa na validação (a forma mudou) vira vazia: nunca derruba a tela. */
export function configSegura(bruto: unknown): PreferenciasDaTabela {
  const lida = preferenciasDaTabelaSchema.safeParse(bruto ?? {});
  return lida.success ? lida.data : {};
}
export const nomeDaVisaoSchema = z.string().trim().min(1).max(60);
export function visaoDaLinha(l: { id: string; tela: string; nome: string; tipo: string; config: unknown; posicao: number | string }): VisaoSalva {
  return { id: l.id, tela: l.tela, nome: l.nome, tipo: (TIPOS_DE_VISUALIZACAO as readonly string[]).includes(l.tipo) ? (l.tipo as TipoDeVisualizacao) : "tabela", config: configSegura(l.config), posicao: Number(l.posicao) };
}
