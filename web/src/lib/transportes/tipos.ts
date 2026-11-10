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

/** O pagamento mora DENTRO do transporte. Cada modalidade tem a sua sequência de status (o banco confere); retirada não tem pagamento. */
export const STATUS_DA_MODALIDADE: Record<Modalidade, readonly { value: string; label: string; tom: Tom }[]> = {
  pta: [{ value: "solicitado", label: "Solicitado", tom: "warning" }, { value: "aprovado", label: "Aprovado", tom: "info" }, { value: "pago", label: "Pago", tom: "success" }],
  tso: [{ value: "orcamento_recebido", label: "Orçamento recebido", tom: "warning" }, { value: "aprovar_nf", label: "Aprovar NF", tom: "info" }, { value: "aprovado", label: "Aprovado", tom: "success" }],
  retirada: [],
};
/** Todos os status numa lista só (a coluna mostra os de todas as modalidades). */
export const TODOS_STATUS_PAGAMENTO = [...STATUS_DA_MODALIDADE.pta, ...STATUS_DA_MODALIDADE.tso.filter((s) => !STATUS_DA_MODALIDADE.pta.some((p) => p.value === s.value))];
export const rotuloStatusPagamento = (v: string) => TODOS_STATUS_PAGAMENTO.find((s) => s.value === v)?.label ?? v;

export type Transporte = {
  id: string; evento_id: string; sentido: Sentido; modalidade: Modalidade | null; distancia_km: number | null; dias_viagem: number;
  referencia: string | null; transportadora: string | null; valor_planejado: number | null; comentarios: string | null; created_at: string;
  /** De onde o carro sai e para onde vai: vêm do evento. */
  origem: string | null; destino: string | null;
  /** Pagamento deste transporte (retirada não tem). */
  status_pagamento: string | null; valor_real: number | null; data_pagamento: string | null; departamento: string | null;
};
export type TransporteNovo = {
  evento_id: string; sentido: Sentido; modalidade?: Modalidade | null; distancia_km?: number | null; dias_viagem?: number; referencia?: string | null;
  transportadora?: string | null; valor_planejado?: number | null; comentarios?: string | null;
  origem?: string | null; destino?: string | null; status_pagamento?: string | null; valor_real?: number | null; data_pagamento?: string | null; departamento?: string | null;
};
/** Qual transporte de ida e de volta cada reserva usa. */
export type VinculoDaReserva = { id: string; transporte_ida_id: string | null; transporte_volta_id: string | null };
