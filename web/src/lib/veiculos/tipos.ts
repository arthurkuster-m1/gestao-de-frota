/** Vocabulários e tipos do veículo. Os valores são os mesmos do CHECK do banco (migration 0002). */

export const CICLO = [
  { value: "pedido_recebido", label: "Pedido recebido" },
  { value: "liberado", label: "Liberado" },
  { value: "em_transporte_0km", label: "Em transporte 0 km" },
  { value: "disponivel_sem_faturamento", label: "Disponível sem faturamento" },
  { value: "disponivel_sem_placa", label: "Disponível sem placa" },
  { value: "em_blindagem", label: "Em blindagem" },
  { value: "disponivel", label: "Pronto" },
  { value: "gravame", label: "Gravame" },
  { value: "venda_vip", label: "Venda VIP" },
  { value: "em_devolucao", label: "Em devolução" },
  { value: "devolvido", label: "Devolvido" },
] as const;
export type Ciclo = (typeof CICLO)[number]["value"];

export const SEGURO = [
  { value: "pendente", label: "Pendente" },
  { value: "cadastrado", label: "Cadastrado" },
  { value: "cancelado", label: "Cancelado" },
] as const;
export type Seguro = (typeof SEGURO)[number]["value"];

export const rotuloCiclo = (v: string) => CICLO.find((c) => c.value === v)?.label ?? v;
export const rotuloSeguro = (v: string) => SEGURO.find((c) => c.value === v)?.label ?? v;

export type Veiculo = {
  id: string;
  codigo: string | null;
  modelo: string; versao: string | null; cor: string | null; my: string | null; pedido: string | null;
  vin: string | null; placa: string | null; blindado: boolean;
  seguro_status: Seguro; status_ciclo: Ciclo;
  data_pedido: string | null; data_liberacao: string | null; data_chegada_planta: string | null; data_faturamento: string | null; data_placas_solicitadas: string | null; data_emplacamento: string | null; data_devolucao: string | null;
  comentarios: string | null;
  created_at: string;
};

/** O que o formulário e a importação enviam ao banco (o código e o espaço de trabalho o banco preenche). */
export type VeiculoNovo = {
  modelo: string; cor?: string | null; my?: string | null; pedido?: string | null;
  vin?: string | null; placa?: string | null; blindado?: boolean;
  seguro_status?: Seguro; status_ciclo?: Ciclo;
  data_pedido?: string | null; data_liberacao?: string | null; data_chegada_planta?: string | null; data_faturamento?: string | null; data_placas_solicitadas?: string | null; data_emplacamento?: string | null; data_devolucao?: string | null;
  comentarios?: string | null;
};

/** Placa: maiúsculas, sem hífen nem espaço ("abc-1d23" → "ABC1D23"). */
export const normalizarPlaca = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
/** VIN (chassi): maiúsculas, sem espaço. */
export const normalizarVin = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const placaValida = (s: string) => /^[A-Z0-9]{7}$/.test(s);
export const vinValido = (s: string) => /^[A-Z0-9]{17}$/.test(s);
export const vazioParaNulo = (s: string | null | undefined) => { const t = (s ?? "").trim(); return t === "" ? null : t; };
