/** Checklists de envio e retorno. Os valores fechados são os mesmos do CHECK do banco (migration 0010). */
export const MOMENTOS = [{ value: "saida", label: "Envio" }, { value: "retorno", label: "Retorno" }] as const;
export type Momento = (typeof MOMENTOS)[number]["value"];
export const rotuloMomento = (m: Momento) => MOMENTOS.find((x) => x.value === m)!.label;

export const COMBUSTIVEIS = [
  { value: "vazio", label: "Vazio" }, { value: "um_quarto", label: "1/4" }, { value: "meio", label: "1/2" }, { value: "tres_quartos", label: "3/4" }, { value: "cheio", label: "Cheio (ou carga completa)" },
] as const;
export const LIMPEZAS = [{ value: "limpo", label: "Limpo" }, { value: "regular", label: "Regular" }, { value: "sujo", label: "Sujo" }] as const;
export const rotuloCombustivel = (v: string | null) => COMBUSTIVEIS.find((x) => x.value === v)?.label ?? null;
export const rotuloLimpeza = (v: string | null) => LIMPEZAS.find((x) => x.value === v)?.label ?? null;

export type Checklist = {
  id: string; reserva_id: string; momento: Momento; data_hora: string; km: number | null; combustivel: string | null; limpeza: string | null;
  recebido_por: string | null; teve_avarias: boolean; avarias: string | null; observacoes: string | null; created_at: string;
};
export type ChecklistNovo = Omit<Checklist, "id" | "created_at">;
