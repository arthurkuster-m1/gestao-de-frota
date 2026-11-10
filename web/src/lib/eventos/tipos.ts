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

export type Evento = { id: string; nome: string; tipo: string | null; status: StatusEvento; solicitante: string | null; comentarios: string | null; created_at: string; chegada_prevista: string | null; retirada_prevista: string | null; contato: string | null; cliente_id?: string | null; origem?: string | null };
export type EventoNovo = { nome: string; tipo?: string | null; status?: StatusEvento; solicitante?: string | null; comentarios?: string | null; chegada_prevista?: string | null; retirada_prevista?: string | null; contato?: string | null; cliente_id?: string | null; origem?: string | null };
export type Reserva = { id: string; evento_id: string; veiculo_id: string; reserva_inicio: string; reserva_fim: string; chegada: string | null; retirada: string | null; estado: EstadoReserva; comentarios: string | null; origem?: string | null; endereco_chegada?: string | null; endereco_retorno?: string | null; status_individual?: StatusEvento | null };

/** Um carro no evento que ainda NÃO tem data (as duas datas vazias): aparece nas listas do evento e do carro, mas não na agenda nem na linha do tempo. */
export type ReservaDoEvento = Omit<Reserva, "reserva_inicio" | "reserva_fim"> & { reserva_inicio: string | null; reserva_fim: string | null };

/** Um endereço do evento (digitado em cada evento; um evento pode ter vários). */
/** `tipo`: "local" = endereço do evento; "origem" = origem extra (a principal fica em eventos.origem). Sem a migration 0022 vem vazio (= local). */
export type EventoLocal = { id: string; evento_id: string; rotulo: string | null; endereco: string; cidade: string | null; estado: string | null; posicao: number; tipo?: "local" | "origem" };
export type EventoLocalNovo = { rotulo?: string | null; endereco: string; cidade?: string | null; estado?: string | null; tipo?: "local" | "origem" };

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

export const rotuloStatusEvento = (v: string) => STATUS_EVENTO.find((s) => s.value === v)?.label ?? v;
export const rotuloEstadoReserva = (v: string) => ESTADOS_RESERVA.find((s) => s.value === v)?.label ?? v;

/** Um carro PEDIDO para o evento (modelo mãe + versão, cor e MY opcionais). `reserva_id` = atendido; `nao_atendido` = não estava disponível. */
export type ModeloDesejado = { id: string; evento_id: string; modelo: string; versao: string | null; cor: string | null; my: string | null; reserva_id: string | null; nao_atendido: boolean; nota: string | null; posicao: number };
export type ModeloDesejadoNovo = { modelo: string; cor?: string | null; my?: string | null };

/** Faixa livre na linha do tempo do carro (Produção, Em faturamento, Emplacamento…). */
export type AnotacaoDoCarro = { id: string; veiculo_id: string; titulo: string; inicio: string; fim: string; comentarios: string | null };
export type AnotacaoNova = { veiculo_id: string; titulo: string; inicio: string; fim: string; comentarios?: string | null };
