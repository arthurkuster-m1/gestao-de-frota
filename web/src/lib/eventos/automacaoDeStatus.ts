import type { Checklist } from "../checklists/tipos";
import type { VinculoDaReserva } from "../transportes/tipos";
import { STATUS_EVENTO, type Evento, type ReservaDoEvento, type StatusEvento } from "./tipos";

/** Quantos dias antes da data de envio / retirada o aviso de transporte entra. */
export const DIAS_DE_ANTECEDENCIA = 7;

export type FatosDoEvento = { carros: number; comTransporteIda: number; comTransporteVolta: number; comChecklistSaida: number; comChecklistRetorno: number };

const etapa = (s: string) => STATUS_EVENTO.findIndex((x) => x.value === s);
/** Dias de hoje até a data (negativo = já passou). null sem data. */
export function diasAte(data: string | null | undefined, hoje: string): number | null {
  if (!data) return null;
  return Math.round((new Date(`${data.slice(0, 10)}T12:00:00Z`).getTime() - new Date(`${hoje}T12:00:00Z`).getTime()) / 86400000);
}

/**
 * O status que o evento deve ter agora. Regras (só anda PARA A FRENTE; Recebido e Planejado são manuais):
 *  - Solicitar transporte: faltam 7 dias (ou menos) para a Data de Envio
 *  - Envio agendado: todos os carros têm transporte de ida
 *  - Em uso: todos os carros têm checklist de saída
 *  - Solicitar retorno: em uso e faltam 7 dias (ou menos) para a Data de Retirada
 *  - Retorno solicitado: o mesmo, e todos os carros já têm transporte de volta
 *  - Concluído: todos os carros têm checklist de retorno
 */
export function statusAutomatico(evento: Pick<Evento, "status" | "envio_previsto" | "retirada_prevista">, f: FatosDoEvento, hoje: string, opcoes: { semRetorno?: boolean } = {}): StatusEvento {
  let atual = evento.status;
  if (etapa(atual) < 0) return atual;
  const todos = f.carros > 0;
  const paraEnvio = diasAte(evento.envio_previsto, hoje), paraRetirada = diasAte(evento.retirada_prevista, hoje);
  for (let volta = 0; volta < STATUS_EVENTO.length; volta++) {
    const em = etapa(atual) >= etapa("em_uso");
    const candidatos: StatusEvento[] = [];
    if (paraEnvio !== null && paraEnvio <= DIAS_DE_ANTECEDENCIA) candidatos.push("solicitar_transporte");
    if (todos && f.comTransporteIda === f.carros) candidatos.push("envio_agendado");
    if (todos && f.comChecklistSaida === f.carros) candidatos.push("em_uso");
    // evento em que os carros não voltam: não há retorno a solicitar nem checklist de retorno (o evento se conclui à mão)
    if (!opcoes.semRetorno) {
      if (em && paraRetirada !== null && paraRetirada <= DIAS_DE_ANTECEDENCIA) candidatos.push("solicitar_retorno");
      if (em && paraRetirada !== null && paraRetirada <= DIAS_DE_ANTECEDENCIA && todos && f.comTransporteVolta === f.carros) candidatos.push("retorno_solicitado");
      if (todos && f.comChecklistRetorno === f.carros) candidatos.push("concluido");
    }
    const melhor = candidatos.reduce<StatusEvento>((m, c) => (etapa(c) > etapa(m) ? c : m), atual);
    if (melhor === atual) break;
    atual = melhor;
  }
  return atual;
}

/** Os fatos de cada evento (carros ativos, quantos têm transporte e checklist). */
export function fatosDosEventos(p: { reservas: readonly ReservaDoEvento[]; vinculos: readonly VinculoDaReserva[]; checklists: readonly Checklist[] }): Map<string, FatosDoEvento> {
  const vin = new Map(p.vinculos.map((v) => [v.id, v]));
  const ck = new Map<string, Set<string>>();
  for (const c of p.checklists) { const s = ck.get(c.reserva_id) ?? new Set<string>(); s.add(c.momento); ck.set(c.reserva_id, s); }
  const m = new Map<string, FatosDoEvento>();
  for (const r of p.reservas) {
    if (r.estado === "cancelado") continue;
    const f = m.get(r.evento_id) ?? { carros: 0, comTransporteIda: 0, comTransporteVolta: 0, comChecklistSaida: 0, comChecklistRetorno: 0 };
    const v = vin.get(r.id), c = ck.get(r.id);
    f.carros++;
    if (v?.transporte_ida_id) f.comTransporteIda++;
    if (v?.transporte_volta_id) f.comTransporteVolta++;
    if (c?.has("saida") || r.estado === "em_uso" || r.estado === "em_retorno" || r.estado === "concluido") f.comChecklistSaida++;
    if (c?.has("retorno") || r.estado === "concluido") f.comChecklistRetorno++;
    m.set(r.evento_id, f);
  }
  return m;
}
