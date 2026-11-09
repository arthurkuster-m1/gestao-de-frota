import type { Manutencao } from "../manutencoes/tipos";
import { bloqueiaAgora, estaEmAberto } from "../manutencoes/regras";
import type { EstadoReserva, Reserva } from "./tipos";

/** O Status de Uso do carro (o que ele está fazendo na operação). */
export const STATUS_DE_USO = [
  { value: "disponivel", label: "Disponível", tom: "success" },
  { value: "reservado", label: "Reservado", tom: "accent" },
  { value: "em_uso", label: "Em uso", tom: "info" },
  { value: "em_retorno", label: "Em retorno", tom: "warning" },
  { value: "manutencao", label: "Manutenção", tom: "error" },
] as const;
export type StatusDeUso = (typeof STATUS_DE_USO)[number]["value"];
export const rotuloDoUso = (v: string) => STATUS_DE_USO.find((s) => s.value === v)?.label ?? v;

/** Reservas que ainda "pesam" na agenda do carro (concluída e cancelada saem). */
export const ESTADOS_ABERTOS: readonly EstadoReserva[] = ["reservado", "em_uso", "em_retorno"];
export const estaAberta = (r: Pick<Reserva, "estado">) => ESTADOS_ABERTOS.includes(r.estado);

/** Quem aparece primeiro na agenda e no status: o que o carro está fazendo agora vem antes do que vem depois. */
const PRIORIDADE: Record<string, number> = { em_retorno: 0, em_uso: 1, reservado: 2 };

/**
 * O Status de Uso é CALCULADO (nunca digitado): manutenção que bloqueia > em retorno > em uso > reservado > disponível.
 * Um carro pode ter várias reservas; basta uma em uso para ele estar em uso. Com `hoje`, manutenção que começa no futuro ainda não conta.
 */
export function statusDeUso(reservas: readonly Pick<Reserva, "estado">[], manutencoes: readonly Pick<Manutencao, "status" | "bloqueia_uso" | "data_inicio">[] = [], hoje?: string): StatusDeUso {
  if (manutencoes.some((m) => bloqueiaAgora(m) && (!hoje || m.data_inicio <= hoje))) return "manutencao";
  const abertas = reservas.filter(estaAberta);
  if (abertas.some((r) => r.estado === "em_retorno")) return "em_retorno";
  if (abertas.some((r) => r.estado === "em_uso")) return "em_uso";
  if (abertas.length > 0) return "reservado";
  return "disponivel";
}

const ROTULO_DA_AGENDA: Record<string, string> = { reservado: "RESERVADO", em_uso: "EM USO", em_retorno: "EM RETORNO" };
const dm = (iso: string, anoAtual: string) => (iso.slice(0, 4) === anoAtual ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`);

/**
 * A agenda do carro em uma linha, acumulando tudo:
 * "EM USO - EVENTO TESOURARIA 04/11 ATÉ 05/11 + RESERVADO - EVENTO X 07/11 ATÉ 12/11 + RESERVADO - EVENTO Y 20/11 ATÉ 22/11".
 * Datas em dd/mm (com o ano só quando não é o ano de `hoje`). Vazio quando não há reserva aberta.
 */
export function agendaTexto(reservas: readonly Reserva[], nomeDoEvento: (eventoId: string) => string, hoje: string, manutencoes: readonly Manutencao[] = []): string {
  const ano = hoje.slice(0, 4);
  const oficina = manutencoes.filter(estaEmAberto).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
    .map((m) => `EM MANUTENÇÃO - ${m.nome.toUpperCase()} ${m.data_fim ? `${dm(m.data_inicio, ano)} ATÉ ${dm(m.data_fim, ano)}` : `DESDE ${dm(m.data_inicio, ano)}`}`);
  const eventos = reservas.filter(estaAberta)
    .sort((a, b) => (PRIORIDADE[a.estado]! - PRIORIDADE[b.estado]!) || a.reserva_inicio.localeCompare(b.reserva_inicio) || a.reserva_fim.localeCompare(b.reserva_fim))
    .map((r) => `${ROTULO_DA_AGENDA[r.estado]} - EVENTO ${nomeDoEvento(r.evento_id).toUpperCase()} ${dm(r.reserva_inicio, ano)} ATÉ ${dm(r.reserva_fim, ano)}`)
  ;
  return [...oficina, ...eventos].join(" + ");
}

export type ItemDaAgenda = { uso: StatusDeUso; texto: string; /** Para onde a tag leva: o evento da reserva ou a manutenção. */ href: string };
const ROTULO_ITEM: Record<string, string> = { reservado: "Reservado", em_uso: "Em uso", em_retorno: "Em retorno" };

/** A agenda do carro item a item (um por reserva/manutenção abertas), na mesma ordem de `agendaTexto`: "Em uso - Evento XYZ 05/11 até 07/11". `uso` dá a cor da tag. */
export function agendaItens(reservas: readonly Reserva[], nomeDoEvento: (eventoId: string) => string, hoje: string, manutencoes: readonly Manutencao[] = []): ItemDaAgenda[] {
  const ano = hoje.slice(0, 4);
  const oficina = manutencoes.filter(estaEmAberto).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
    .map((m): ItemDaAgenda => ({ uso: "manutencao", href: `/manutencoes/${m.id}`, texto: `Em manutenção - ${m.nome} ${m.data_fim ? `${dm(m.data_inicio, ano)} até ${dm(m.data_fim, ano)}` : `desde ${dm(m.data_inicio, ano)}`}` }));
  const eventos = reservas.filter(estaAberta)
    .sort((a, b) => (PRIORIDADE[a.estado]! - PRIORIDADE[b.estado]!) || a.reserva_inicio.localeCompare(b.reserva_inicio) || a.reserva_fim.localeCompare(b.reserva_fim))
    .map((r): ItemDaAgenda => ({ uso: r.estado as StatusDeUso, href: `/eventos/${r.evento_id}`, texto: `${ROTULO_ITEM[r.estado]} - Evento ${nomeDoEvento(r.evento_id)} ${dm(r.reserva_inicio, ano)} até ${dm(r.reserva_fim, ano)}` }));
  return [...oficina, ...eventos];
}

/** As reservas abertas do carro que se sobrepõem ao período (datas inclusivas). `ignorarEvento`: o próprio evento, ao editá-lo. */
export function conflitos(periodo: { inicio: string; fim: string }, reservasDoCarro: readonly Reserva[], ignorarEvento?: string): Reserva[] {
  return reservasDoCarro.filter((r) => estaAberta(r) && r.evento_id !== ignorarEvento && r.reserva_inicio <= periodo.fim && periodo.inicio <= r.reserva_fim);
}

/** Agrupa as reservas por carro (para calcular status e agenda de toda a frota de uma vez). */
export function reservasPorVeiculo(reservas: readonly Reserva[]): Map<string, Reserva[]> {
  const m = new Map<string, Reserva[]>();
  for (const r of reservas) { const l = m.get(r.veiculo_id); if (l) l.push(r); else m.set(r.veiculo_id, [r]); }
  return m;
}
