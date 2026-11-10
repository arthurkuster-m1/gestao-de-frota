import type { Checklist } from "../checklists/tipos";
import type { Reserva, ReservaDoEvento } from "../eventos/tipos";
import type { Transporte, VinculoDaReserva } from "./tipos";

/** Em que pé está cada transporte que ainda não foi pago. */
export type SituacaoFinanceira = "aprovado" | "executado" | "a_executar";
export type ItemDaPrevisao = { transporte: Transporte; valor: number; semValor: boolean; situacao: SituacaoFinanceira; executado: boolean };
export type PrevisaoFinanceira = {
  itens: ItemDaPrevisao[];
  /** Soma por situação (valor real quando existe; senão o planejado). */
  aprovados: number; executados: number; aExecutar: number;
  /** O que se espera pagar no próximo mês: aprovados + executados aguardando aprovação. */
  previsao: number;
  /** Quantos itens da previsão estão sem valor cadastrado. */
  semValor: number;
};

/**
 * A perna (ida ou volta) foi EXECUTADA quando todos os carros dela já fizeram o checklist correspondente
 * (saída para a ida, retorno para a volta) — ou a reserva já está no estado que isso causa (em uso / concluída).
 */
export function transporteExecutado(t: Pick<Transporte, "id" | "sentido">, p: { vinculos: readonly VinculoDaReserva[]; reservas: readonly (Reserva | ReservaDoEvento)[]; checklists: readonly Checklist[] }): boolean {
  const ids = p.vinculos.filter((v) => (t.sentido === "ida" ? v.transporte_ida_id : v.transporte_volta_id) === t.id).map((v) => v.id);
  if (ids.length === 0) return false;
  const momento = t.sentido === "ida" ? "saida" : "retorno";
  return ids.every((id) => {
    const r = p.reservas.find((x) => x.id === id);
    if (!r || r.estado === "cancelado") return true;   // carro que saiu do evento não segura o transporte
    if (p.checklists.some((c) => c.reserva_id === id && c.momento === momento)) return true;
    return t.sentido === "ida" ? r.estado === "em_uso" || r.estado === "em_retorno" || r.estado === "concluido" : r.estado === "concluido";
  });
}

/**
 * A previsão de pagamento: entre os transportes ainda NÃO pagos (retirada não tem pagamento; PTA "pago" e NF com data de pagamento já saíram),
 *  - Aprovados: PTA ou NF aprovada — prontos para pagar;
 *  - Executados: o transporte já foi feito (checklist) mas a PTA/NF ainda não foi aprovada — provável a pagar;
 *  - A executar: ainda não aconteceu — fica de fora da previsão, só aparece como compromisso adiante.
 */
export function previsaoFinanceira(p: { transportes: readonly Transporte[]; vinculos: readonly VinculoDaReserva[]; reservas: readonly (Reserva | ReservaDoEvento)[]; checklists: readonly Checklist[] }): PrevisaoFinanceira {
  const itens: ItemDaPrevisao[] = [];
  for (const t of p.transportes) {
    if (t.modalidade === "retirada") continue;
    if (t.status_pagamento === "pago" || t.data_pagamento) continue;
    const executado = transporteExecutado(t, p);
    const situacao: SituacaoFinanceira = t.status_pagamento === "aprovado" ? "aprovado" : executado ? "executado" : "a_executar";
    const valor = t.valor_real ?? t.valor_planejado ?? 0;
    itens.push({ transporte: t, valor, semValor: t.valor_real == null && t.valor_planejado == null, situacao, executado });
  }
  const soma = (s: SituacaoFinanceira) => itens.filter((i) => i.situacao === s).reduce((a, i) => a + i.valor, 0);
  const aprovados = soma("aprovado"), executados = soma("executado"), aExecutar = soma("a_executar");
  return { itens, aprovados, executados, aExecutar, previsao: aprovados + executados, semValor: itens.filter((i) => i.situacao !== "a_executar" && i.semValor).length };
}
