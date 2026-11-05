/** Vocabulários e tipos de transportes e pagamentos. Os valores fechados são os mesmos do CHECK do banco (migration 0009). */
type Tom = "success" | "warning" | "error" | "info" | "neutral" | "accent";

export const SENTIDOS = [{ value: "ida", label: "Ida", tom: "info" }, { value: "volta", label: "Volta", tom: "accent" }] as const satisfies readonly { value: string; label: string; tom: Tom }[];
export const MODALIDADES = [
  { value: "pta", label: "PTA (Workcar)", tom: "info" },
  { value: "tso", label: "TSO", tom: "accent" },
  { value: "retirada", label: "Retirada", tom: "neutral" },
] as const satisfies readonly { value: string; label: string; tom: Tom }[];
export type Sentido = (typeof SENTIDOS)[number]["value"];
export type Modalidade = (typeof MODALIDADES)[number]["value"];

export const TIPOS_PAGAMENTO = [{ value: "pta", label: "PTA", tom: "info" }, { value: "nf_tso", label: "NF da TSO", tom: "accent" }] as const satisfies readonly { value: string; label: string; tom: Tom }[];
export type TipoPagamento = (typeof TIPOS_PAGAMENTO)[number]["value"];

/** Cada tipo tem a sua sequência de status (o banco confere). */
export const STATUS_DO_TIPO: Record<TipoPagamento, readonly { value: string; label: string; tom: Tom }[]> = {
  pta: [{ value: "solicitado", label: "Solicitado", tom: "warning" }, { value: "aprovado", label: "Aprovado", tom: "info" }, { value: "pago", label: "Pago", tom: "success" }],
  nf_tso: [{ value: "orcamento_recebido", label: "Orçamento recebido", tom: "warning" }, { value: "aprovar_nf", label: "Aprovar NF", tom: "info" }, { value: "aprovado", label: "Aprovado", tom: "success" }],
};
/** Todos os status numa lista só (a coluna Status mostra os dois tipos). */
export const TODOS_STATUS_PAGAMENTO = [...STATUS_DO_TIPO.pta, ...STATUS_DO_TIPO.nf_tso.filter((s) => !STATUS_DO_TIPO.pta.some((p) => p.value === s.value))];
export const rotuloStatusPagamento = (v: string) => TODOS_STATUS_PAGAMENTO.find((s) => s.value === v)?.label ?? v;
export const statusInicial = (t: TipoPagamento) => STATUS_DO_TIPO[t][0]!.value;

export type Transporte = {
  id: string; evento_id: string; sentido: Sentido; modalidade: Modalidade; distancia_km: number | null; dias_viagem: number;
  referencia: string | null; transportadora: string | null; valor_planejado: number | null; pagamento_id: string | null; comentarios: string | null; created_at: string;
};
export type TransporteNovo = {
  evento_id: string; sentido: Sentido; modalidade: Modalidade; distancia_km?: number | null; dias_viagem?: number; referencia?: string | null;
  transportadora?: string | null; valor_planejado?: number | null; pagamento_id?: string | null; comentarios?: string | null;
};
export type Pagamento = {
  id: string; tipo: TipoPagamento; numero: string; status: string; valor_planejado: number | null; valor_real: number | null;
  data_pagamento: string | null; departamento: string | null; comentarios: string | null; created_at: string;
};
export type PagamentoNovo = { tipo: TipoPagamento; numero: string; status?: string; valor_planejado?: number | null; valor_real?: number | null; data_pagamento?: string | null; departamento?: string | null; comentarios?: string | null };
/** Qual transporte de ida e de volta cada reserva usa. */
export type VinculoDaReserva = { id: string; transporte_ida_id: string | null; transporte_volta_id: string | null };
