import { somarDias } from "../motor/datas";
import type { SegmentoDeBarra } from "./tipos";

type Tom = SegmentoDeBarra["tom"];

/**
 * Quebra uma reserva em logística (ida) + evento + logística (volta), como no desenho do Arthur:
 * [início da reserva … dia antes da chegada] [chegada … retirada] [dia depois da retirada … fim da reserva].
 * Sem chegada e retirada, é um bloco só.
 */
export function segmentosDaReserva(r: { reserva_inicio: string; reserva_fim: string; chegada: string | null; retirada: string | null }, tomPrincipal: Tom, tomLogistica: Tom = "info"): SegmentoDeBarra[] {
  const chegada = r.chegada ?? r.retirada, retirada = r.retirada ?? r.chegada;
  if (!chegada || !retirada) return [{ inicio: r.reserva_inicio, fim: r.reserva_fim, tom: tomPrincipal, tipo: "principal" }];
  const segs: SegmentoDeBarra[] = [];
  if (chegada > r.reserva_inicio) segs.push({ inicio: r.reserva_inicio, fim: somarDias(chegada, -1), tom: tomLogistica, tipo: "logistica" });
  segs.push({ inicio: chegada, fim: retirada, tom: tomPrincipal, tipo: "principal" });
  if (retirada < r.reserva_fim) segs.push({ inicio: somarDias(retirada, 1), fim: r.reserva_fim, tom: tomLogistica, tipo: "logistica" });
  return segs;
}
