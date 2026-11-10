/** Contratos de comodato e aditivos. Os valores fechados são os mesmos do CHECK do banco (migration 0011). */
type Tom = "success" | "warning" | "error" | "info" | "neutral" | "accent";
export const STATUS_CONTRATO = [
  { value: "rascunho", label: "Planejado", tom: "neutral" },
  { value: "enviado", label: "Enviado", tom: "info" },
  { value: "aguardando_assinaturas", label: "Aguardando assinaturas", tom: "warning" },
  { value: "assinado", label: "Assinado", tom: "success" },
  { value: "encerrado", label: "Encerrado", tom: "neutral" },
] as const satisfies readonly { value: string; label: string; tom: Tom }[];
export type StatusContrato = (typeof STATUS_CONTRATO)[number]["value"];
/** O aditivo tem a mesma sequência, menos "Encerrado". */
export const STATUS_ADITIVO = STATUS_CONTRATO.filter((s) => s.value !== "encerrado");
export const TIPOS_ADITIVO = [{ value: "troca_carros", label: "Troca de carros", tom: "accent" }, { value: "extensao_prazo", label: "Extensão de prazo", tom: "info" }] as const satisfies readonly { value: string; label: string; tom: Tom }[];
export type TipoAditivo = (typeof TIPOS_ADITIVO)[number]["value"];
export const rotuloStatusContrato = (v: string) => STATUS_CONTRATO.find((s) => s.value === v)?.label ?? v;
export const rotuloTipoAditivo = (v: string) => TIPOS_ADITIVO.find((s) => s.value === v)?.label ?? v;

export type Contrato = { id: string; evento_id: string; cliente_id: string; status: StatusContrato; vigencia_inicio: string | null; vigencia_fim: string | null; assinado_em: string | null; observacoes: string | null; snapshot: Record<string, unknown> | null; created_at: string };
export type ContratoNovo = { evento_id: string; cliente_id: string; status?: StatusContrato; vigencia_inicio?: string | null; vigencia_fim?: string | null; observacoes?: string | null; snapshot?: Record<string, unknown> | null };
export type ContratoVeiculo = { id: string; contrato_id: string; veiculo_id: string };
export type Aditivo = { id: string; contrato_id: string; tipo: TipoAditivo; status: StatusContrato; motivo: string | null; vigencia_fim_anterior: string | null; vigencia_fim_nova: string | null; assinado_em: string | null; titulo: string | null; data_efeito: string | null; snapshot: Record<string, unknown> | null; created_at: string };
export type AditivoNovo = { contrato_id: string; tipo: TipoAditivo; motivo?: string | null; vigencia_fim_anterior?: string | null; vigencia_fim_nova?: string | null; titulo?: string | null; data_efeito?: string | null; snapshot?: Record<string, unknown> | null };
export type AditivoVeiculo = { id: string; aditivo_id: string; veiculo_id: string; acao: "sai" | "entra" };
