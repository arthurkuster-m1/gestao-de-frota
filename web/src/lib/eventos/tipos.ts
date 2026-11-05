/** Vocabulários e tipos de eventos e reservas. Os valores fechados são os mesmos do CHECK do banco (migration 0006). */
type Tom = "success" | "warning" | "error" | "info" | "neutral" | "accent";

export const STATUS_EVENTO = [
  { value: "planejado", label: "Planejado", tom: "neutral" },
  { value: "solicitar_transporte", label: "Solicitar transporte", tom: "warning" },
  { value: "envio_solicitado", label: "Envio solicitado", tom: "info" },
  { value: "em_uso", label: "Em uso", tom: "accent" },
  { value: "solicitar_retorno", label: "Solicitar retorno", tom: "warning" },
  { value: "retorno_solicitado", label: "Retorno solicitado", tom: "info" },
  { value: "concluido", label: "Concluído", tom: "success" },
] as const satisfies readonly { value: string; label: string; tom: Tom }[];
export type StatusEvento = (typeof STATUS_EVENTO)[number]["value"];

/** Vocabulário ABERTO (o banco guarda texto livre): esta é só a lista sugerida. */
export const TIPOS_EVENTO = ["Comodato longo (mais de 1 mês)", "Evento", "Gravação", "Agrifeira", "Lançamento", "Treinamento", "Corrida", "Experience", "Evento de varejo", "Outro"] as const;

export const ESTADOS_RESERVA = [
  { value: "reservado", label: "Reservado", tom: "info" },
  { value: "em_uso", label: "Em uso", tom: "accent" },
  { value: "em_retorno", label: "Em retorno", tom: "warning" },
  { value: "concluido", label: "Concluído", tom: "success" },
  { value: "cancelado", label: "Cancelado", tom: "neutral" },
] as const satisfies readonly { value: string; label: string; tom: Tom }[];
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number]["value"];

export type Evento = { id: string; nome: string; tipo: string | null; status: StatusEvento; solicitante: string | null; comentarios: string | null; created_at: string };
export type EventoNovo = { nome: string; tipo?: string | null; status?: StatusEvento; solicitante?: string | null; comentarios?: string | null };
export type Reserva = { id: string; evento_id: string; veiculo_id: string; reserva_inicio: string; reserva_fim: string; estado: EstadoReserva; comentarios: string | null };

export const rotuloStatusEvento = (v: string) => STATUS_EVENTO.find((s) => s.value === v)?.label ?? v;
export const rotuloEstadoReserva = (v: string) => ESTADOS_RESERVA.find((s) => s.value === v)?.label ?? v;
