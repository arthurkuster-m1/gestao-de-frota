import type { Modalidade, Sentido, Transporte, TransporteNovo, VinculoDaReserva } from "./tipos";

/**
 * O transporte no evento é identificado pelo CÓDIGO (campo "Transporte" do carro: PTAS00666314, NF da TSO…): carros com o mesmo código
 * no mesmo sentido são UM transporte, e km, modalidade, transportadora e valor são do transporte (iguais para todos eles).
 * Antes do código, o carro tem um transporte "rascunho" (sem código) só dele, que guarda o que já foi preenchido.
 */
export type CampoDeTransporte = "referencia" | "modalidade" | "transportadora" | "valor_planejado" | "distancia_km";
export type Operacao =
  | { tipo: "criar"; novo: TransporteNovo; reservaIds: string[] }
  | { tipo: "vincular"; reservaIds: string[]; sentido: Sentido; transporteId: string | null }
  | { tipo: "atualizar"; id: string; patch: Partial<Omit<TransporteNovo, "evento_id">> }
  | { tipo: "excluir"; id: string };

type Entrada = {
  transportes: readonly Transporte[]; vinculos: readonly VinculoDaReserva[]; eventoId: string; sentido: Sentido; reservaId: string;
  campo: CampoDeTransporte; valor: string | number | null; rota: { origem: string | null; destino: string | null };
};

export const idDoTransporteDaReserva = (v: VinculoDaReserva | undefined, s: Sentido) => (v ? (s === "ida" ? v.transporte_ida_id : v.transporte_volta_id) : null);
export const reservasDoTransporte = (vinculos: readonly VinculoDaReserva[], s: Sentido, id: string) => vinculos.filter((v) => idDoTransporteDaReserva(v, s) === id).map((v) => v.id);

export function planejarCampo(e: Entrada): Operacao[] {
  const { transportes, vinculos, eventoId, sentido, reservaId, campo, rota } = e;
  const tid = idDoTransporteDaReserva(vinculos.find((x) => x.id === reservaId), sentido);
  const t = tid ? (transportes.find((x) => x.id === tid) ?? null) : null;
  const nCarros = (id: string) => reservasDoTransporte(vinculos, sentido, id).length;

  if (campo !== "referencia") {
    const patch: Partial<Omit<TransporteNovo, "evento_id">> = campo === "modalidade" && e.valor === "tso" ? { modalidade: "tso" as Modalidade, transportadora: "TSO" } : { [campo]: e.valor };   // TSO: a transportadora é sempre TSO
    if (t) return [{ tipo: "atualizar", id: t.id, patch }];
    return [{ tipo: "criar", novo: { evento_id: eventoId, sentido, referencia: null, modalidade: null, origem: rota.origem, destino: rota.destino, ...patch }, reservaIds: [reservaId] }];
  }

  const ref = typeof e.valor === "string" ? e.valor.trim().toUpperCase() : "";
  if (!ref) {
    if (!t) return [];
    return nCarros(t.id) <= 1 ? [{ tipo: "atualizar", id: t.id, patch: { referencia: null } }] : [{ tipo: "vincular", reservaIds: [reservaId], sentido, transporteId: null }];
  }
  const igual = transportes.find((x) => x.evento_id === eventoId && x.sentido === sentido && x.referencia && x.referencia.toLowerCase() === ref.toLowerCase());
  if (igual) {
    if (t?.id === igual.id) return [];
    const ops: Operacao[] = [{ tipo: "vincular", reservaIds: [reservaId], sentido, transporteId: igual.id }];
    if (t && !t.referencia && nCarros(t.id) <= 1) ops.push({ tipo: "excluir", id: t.id });   // o rascunho do carro some: ele entrou num transporte que já existe
    return ops;
  }
  if (t) {
    if (!t.referencia || nCarros(t.id) <= 1) return [{ tipo: "atualizar", id: t.id, patch: { referencia: ref } }];   // renomeia o transporte dele
    // o transporte é de vários carros: este carro ganha um novo, com os mesmos dados, e sai do antigo
    return [{ tipo: "criar", reservaIds: [reservaId], novo: { evento_id: eventoId, sentido, referencia: ref, modalidade: t.modalidade, transportadora: t.transportadora, valor_planejado: t.valor_planejado, distancia_km: t.distancia_km, origem: t.origem, destino: t.destino } }];
  }
  return [{ tipo: "criar", reservaIds: [reservaId], novo: { evento_id: eventoId, sentido, referencia: ref, modalidade: null, origem: rota.origem, destino: rota.destino } }];
}
