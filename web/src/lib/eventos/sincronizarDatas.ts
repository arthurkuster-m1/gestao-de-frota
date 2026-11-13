import { diferencaEmDias, somarDias } from "../motor/datas";
import { semFim } from "./tipos";

type Datas = { reserva_inicio: string; reserva_fim: string; chegada: string | null; retirada: string | null };
export type PatchDeDatas = Partial<Datas>;

/**
 * Muda a CHEGADA e/ou a RETIRADA de uma reserva levando junto o prazo de logística: a janela da reserva (início..fim) já inclui os dias de
 * ida e de volta, então ela anda com a data (a margem entre início e chegada, e entre retirada e fim, se mantém). Sem chegada/retirada própria,
 * o próprio início/fim faz esse papel. Devolve só o que mudou; erro com mensagem clara se a nova data não cabe (retirada antes da chegada).
 */
export function patchDeDatas(r: Datas, nova: { chegada?: string | null; retirada?: string | null }): PatchDeDatas {
  let ini = r.reserva_inicio, fim = r.reserva_fim, chegada = r.chegada, retirada = r.retirada;
  const aberta = semFim(fim);
  if (nova.chegada) {
    const margem = r.chegada && ini ? Math.max(0, diferencaEmDias(ini, r.chegada)) : 0;
    chegada = nova.chegada; ini = somarDias(nova.chegada, -margem);
  }
  if (nova.retirada) {
    const margem = !aberta && r.retirada && fim ? Math.max(0, diferencaEmDias(r.retirada, fim)) : 0;
    retirada = nova.retirada; fim = somarDias(nova.retirada, margem);
  }
  if (chegada && retirada && chegada > retirada) throw new Error("A retirada não pode ser antes da chegada.");
  if (!aberta && chegada && chegada > fim) fim = chegada;
  if (retirada && retirada < ini) ini = retirada;
  const out: PatchDeDatas = {};
  if (ini !== r.reserva_inicio) out.reserva_inicio = ini;
  if (fim !== r.reserva_fim) out.reserva_fim = fim;
  if (chegada !== r.chegada) out.chegada = chegada;
  if (retirada !== r.retirada) out.retirada = retirada;
  return out;
}

/** As datas do evento são as dos carros: a chegada mais cedo e a retirada mais tarde (reserva em aberto não tem retirada). null se nenhum carro tem data. */
export function datasPelasReservas(reservas: readonly (Datas & { estado: string })[]): { chegada: string; retirada: string | null } | null {
  const ativas = reservas.filter((r) => r.estado !== "cancelado" && r.reserva_inicio);
  if (ativas.length === 0) return null;
  const chegada = ativas.map((r) => r.chegada ?? r.reserva_inicio).sort()[0]!;
  const fechadas = ativas.filter((r) => !semFim(r.reserva_fim));
  const retirada = fechadas.length ? fechadas.map((r) => r.retirada ?? r.reserva_fim).sort().at(-1)! : null;
  return { chegada, retirada };
}
