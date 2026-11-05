import type { Pagamento, Sentido, Transporte, VinculoDaReserva } from "./tipos";

/** Dias de viagem = km ÷ 500 para cima; retirada não tem viagem. (O banco calcula igual; aqui serve para mostrar antes de salvar.) */
export const diasDeViagem = (km: number | null | undefined, modalidade: string) => (modalidade === "retirada" || !km || km <= 0 ? 0 : Math.ceil(km / 500));

/** Aceita "1234,56", "1.234,56" e "1234.56"; devolve o número ou null se não for número. */
export function paraNumero(texto: string): number | null {
  let t = texto.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (t === "") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
export const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Qual pagamento combina com cada modalidade (retirada não tem pagamento). */
export const tipoDePagamentoDaModalidade = (m: string) => (m === "pta" ? "pta" : m === "tso" ? "nf_tso" : null);

/** Os pagamentos que podem ser ligados a um transporte daquela modalidade. */
export const pagamentosQueCombinam = (modalidade: string, pagamentos: readonly Pagamento[]) => { const t = tipoDePagamentoDaModalidade(modalidade); return t ? pagamentos.filter((p) => p.tipo === t) : []; };

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
