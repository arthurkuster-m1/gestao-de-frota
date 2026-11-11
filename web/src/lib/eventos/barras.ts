import type { Barra, SegmentoDeBarra } from "../linhaDoTempo/tipos";
import { segmentosDaReserva } from "../linhaDoTempo/segmentos";
import { somarDias } from "../motor/datas";
import { SEM_FIM, semFim, type Evento, type EstadoReserva, type Reserva } from "./tipos";
import { hojeLocal } from "../motor/datas";

/** Até onde se desenha a barra de uma reserva em aberto (sem data final): 30 dias depois de hoje (ou do início). */
const fimDesenhado = (inicio: string) => somarDias(inicio > hojeLocal() ? inicio : hojeLocal(), 30);

type Tom = Barra["tom"];
/** A cor da barra de cada estado de reserva (reservado = cinza, como no desenho do Arthur). */
export const TOM_DO_ESTADO: Record<EstadoReserva, Tom> = { reservado: "neutral", em_uso: "accent", em_retorno: "warning", concluido: "success", cancelado: "neutral" };

/** As barras de UM carro: uma por reserva (cancelada não aparece). Duas reservas no mesmo dia se empilham. */
export function barrasDoVeiculo(reservas: readonly Reserva[], nomeDoEvento: (eventoId: string) => string, destacarEvento?: string | null): Barra[] {
  return reservas.filter((r) => r.estado !== "cancelado").map((r) => { const aberta = semFim(r.reserva_fim); const rd = aberta ? { ...r, reserva_fim: fimDesenhado(r.reserva_inicio) } : r; return ({
    id: r.id, inicio: r.reserva_inicio, fim: rd.reserva_fim, rotulo: aberta ? `${nomeDoEvento(r.evento_id)} · em aberto` : nomeDoEvento(r.evento_id), tom: TOM_DO_ESTADO[r.estado],
    segmentos: segmentosDaReserva(rd, TOM_DO_ESTADO[r.estado]), movel: r.estado !== "concluido" && !aberta, esticavel: r.estado !== "concluido" && !aberta,
    destaque: !!destacarEvento && r.evento_id === destacarEvento, dados: { reservaId: r.id, eventoId: r.evento_id },
  }); });
}

/**
 * A barra de UM evento: do primeiro dia da primeira reserva ao último da última, com a logística em azul antes e depois
 * do evento em si (do dia que o primeiro carro chega ao dia que o último sai). Sem carros reservados, sem barra.
 */
export function barraDoEvento(evento: Pick<Evento, "id" | "nome">, reservas: readonly Reserva[]): Barra[] {
  const ativas = reservas.filter((r) => r.estado !== "cancelado");
  if (ativas.length === 0) return [];
  const inicio = ativas.map((r) => r.reserva_inicio).sort()[0]!;
  const aberto = ativas.some((r) => semFim(r.reserva_fim));
  const fim = aberto ? fimDesenhado(inicio) : ativas.map((r) => r.reserva_fim).sort().at(-1)!;
  const chegadas = ativas.map((r) => r.chegada ?? r.retirada).filter((d): d is string => !!d).sort();
  const retiradas = ativas.map((r) => r.retirada ?? r.chegada).filter((d): d is string => !!d).sort();
  let segmentos: SegmentoDeBarra[] | undefined;
  if (chegadas.length && retiradas.length) {
    segmentos = segmentosDaReserva({ reserva_inicio: inicio, reserva_fim: fim, chegada: chegadas[0]!, retirada: retiradas.at(-1)! }, "neutral");
  }
  return [{ id: evento.id, inicio, fim, rotulo: `${evento.nome} · ${ativas.length} carro${ativas.length === 1 ? "" : "s"}${aberto ? " · em aberto" : ""}`, tom: "neutral", segmentos, movel: !aberto, esticavel: false, dados: { eventoId: evento.id } }];
}

/** Em que dia termina o prazo de ida / começa o de volta: útil para mostrar "N dias de logística" no formulário. */
export const diasDeLogistica = (inicio: string, chegada: string | null, retirada: string | null, fim: string) => ({
  ida: chegada ? Math.max(0, Math.round((Date.parse(chegada + "T00:00:00Z") - Date.parse(inicio + "T00:00:00Z")) / 86_400_000)) : 0,
  volta: retirada ? Math.max(0, Math.round((Date.parse(fim + "T00:00:00Z") - Date.parse(retirada + "T00:00:00Z")) / 86_400_000)) : 0,
});

/** O período da reserva a partir da chegada, da retirada e dos dias de logística (ida e volta). */
export function periodoDaReserva(chegada: string, retirada: string, diasIda: number, diasVolta: number) {
  return { inicio: somarDias(chegada, -Math.max(0, diasIda)), fim: somarDias(retirada, Math.max(0, diasVolta)) };
}
