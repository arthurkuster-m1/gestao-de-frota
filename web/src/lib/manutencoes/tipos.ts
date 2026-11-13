/** Vocabulários e tipos de manutenções (inclui sinistros). Os valores fechados são os mesmos do CHECK do banco (migration 0008). */
type Tom = "success" | "warning" | "error" | "info" | "neutral" | "accent";

export const STATUS_MANUTENCAO = [
  { value: "solicitar_da", label: "Solicitar DA", tom: "warning" },
  { value: "em_reparo", label: "Em reparo", tom: "info" },
  { value: "pronto", label: "Pronto", tom: "success" },
] as const satisfies readonly { value: string; label: string; tom: Tom }[];
export type StatusManutencao = (typeof STATUS_MANUTENCAO)[number]["value"];
export const rotuloStatusManutencao = (v: string) => STATUS_MANUTENCAO.find((s) => s.value === v)?.label ?? v;

/** Vocabulário ABERTO (o banco guarda texto livre): esta é só a lista sugerida. */
export const TIPOS_MANUTENCAO = ["Sinistro", "Mecânica", "Funilaria e pintura", "Revisão", "Pneus", "Outro"] as const;

export type Manutencao = {
  id: string; veiculo_id: string; nome: string; tipo: string | null; status: StatusManutencao;
  data_ocorrencia: string | null; data_da_solicitada: string | null; data_inicio: string; data_fim: string | null;
  bloqueia_uso: boolean; valor: number | null; descricao: string | null; comentarios: string | null; created_at: string;
};
export type ManutencaoNova = {
  veiculo_id: string; nome: string; tipo?: string | null; status?: StatusManutencao; data_ocorrencia?: string | null; data_da_solicitada?: string | null;
  data_inicio?: string; data_fim?: string | null; bloqueia_uso?: boolean; valor?: number | null; descricao?: string | null; comentarios?: string | null;
};
