import type { Sentido, Transporte, VinculoDaReserva } from "./tipos";

/** Distância curta (menos de 200 km): o carro sai e chega no mesmo dia, sem dia de viagem. */
export const KM_DE_UM_DIA = 200;
/** Dias de viagem = km ÷ 500 para cima; menos de 200 km ou retirada: 0 (mesmo dia). (O banco calcula igual; aqui serve para mostrar antes de salvar.) */
export const diasDeViagem = (km: number | null | undefined, modalidade: string) => (modalidade === "retirada" || !km || km <= 0 || km < KM_DE_UM_DIA ? 0 : Math.ceil(km / 500));

/** Aceita "1234,56", "1.234,56" e "1234.56"; devolve o número ou null se não for número. */
export function paraNumero(texto: string): number | null {
  let t = texto.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (t === "") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
export const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** O valor planejado de cada evento = soma dos transportes dele. */
export function valorPorEvento(transportes: readonly Transporte[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of transportes) if (t.valor_planejado) m.set(t.evento_id, (m.get(t.evento_id) ?? 0) + t.valor_planejado);
  return m;
}

/** As reservas (ids) que usam cada transporte, no sentido dele. */
export function reservasDoTransporte(t: Pick<Transporte, "id" | "sentido">, vinculos: readonly VinculoDaReserva[]): string[] {
  return vinculos.filter((v) => (t.sentido === "ida" ? v.transporte_ida_id : v.transporte_volta_id) === t.id).map((v) => v.id);
}
export const colunaDoSentido = (s: Sentido) => (s === "ida" ? "transporte_ida_id" : "transporte_volta_id") as "transporte_ida_id" | "transporte_volta_id";
