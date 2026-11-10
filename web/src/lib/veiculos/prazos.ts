import type { Veiculo } from "./tipos";

const diasEntre = (de: string | null | undefined, ate: string | null | undefined): number | null => {
  if (!de || !ate) return null;
  return Math.round((Date.parse(`${ate.slice(0, 10)}T12:00:00Z`) - Date.parse(`${de.slice(0, 10)}T12:00:00Z`)) / 86400000);
};

/**
 * Os prazos da placa, em dias corridos (null enquanto falta uma das datas):
 *  - paraSolicitar: da chegada na planta até pedir as placas (quanto demoramos para solicitar);
 *  - paraEmplacar: do pedido das placas até o emplacamento (quanto leva para emplacar);
 *  - total: da chegada na planta até o emplacamento.
 */
export function prazosDaPlaca(v: Pick<Veiculo, "data_chegada_planta" | "data_placas_solicitadas" | "data_emplacamento">) {
  return {
    paraSolicitar: diasEntre(v.data_chegada_planta, v.data_placas_solicitadas),
    paraEmplacar: diasEntre(v.data_placas_solicitadas, v.data_emplacamento),
    total: diasEntre(v.data_chegada_planta, v.data_emplacamento),
  };
}
export const textoDeDias = (n: number | null) => (n === null ? "—" : `${n} dia${n === 1 || n === -1 ? "" : "s"}`);
