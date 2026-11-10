import type { Veiculo } from "../veiculos/tipos";
import type { ModeloDesejado } from "./tipos";

const k = (t: string | null | undefined) => (t ?? "").trim().toLowerCase();

const norm = (t: string | null | undefined) => (t ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** O carro cabe no pedido? O modelo pedido ("S10", "S10 TRAILBOSS PITCH") tem de ser o começo do modelo do carro, palavra por palavra; cor e MY só se foram informados. Sem diferenciar maiúsculas. */
export function combina(v: Pick<Veiculo, "modelo" | "cor" | "my"> & { blindado?: boolean }, d: Pick<ModeloDesejado, "modelo" | "cor" | "my"> & { blindado?: boolean | null }): boolean {
  const vm = norm(v.modelo), dm = norm(d.modelo);
  if (dm === "" || !(vm === dm || vm.startsWith(dm + " "))) return false;
  if (d.cor && norm(v.cor) !== norm(d.cor)) return false;
  if (d.my && norm(v.my) !== norm(d.my)) return false;
  if (d.blindado != null && !!v.blindado !== d.blindado) return false;   // blindagem pedida (sim/não); vazio = tanto faz
  return true;
}

/** "S10 TRAILBOSS PITCH · Branco · 2027" */
export const rotuloDoDesejado = (d: Pick<ModeloDesejado, "modelo" | "cor" | "my"> & { blindado?: boolean | null }) => [d.modelo, d.cor, d.my, d.blindado == null ? null : d.blindado ? "blindado" : "sem blindagem"].filter(Boolean).join(" · ");

/** O carro cabe em algum dos pedidos ainda em aberto (nem atendido nem marcado como indisponível)? Sem pedidos em aberto, qualquer carro serve. */
export function cabeNosPedidos(v: Pick<Veiculo, "modelo" | "cor" | "my"> & { blindado?: boolean }, pedidos: readonly ModeloDesejado[]): boolean {
  const abertos = pedidos.filter((p) => !p.reserva_id && !p.nao_atendido);
  return abertos.length === 0 || abertos.some((p) => combina(v, p));
}

/** Primeiro pedido em aberto que o carro atende (para ligar a reserva ao pedido). */
export const pedidoQueAtende = (v: Pick<Veiculo, "modelo" | "cor" | "my"> & { blindado?: boolean }, pedidos: readonly ModeloDesejado[]) => pedidos.find((p) => !p.reserva_id && !p.nao_atendido && combina(v, p));

/**
 * Quem atende cada pedido do evento: o carro da reserva ligada ao pedido; os pedidos ainda sem ligação procuram, entre os carros do evento
 * que ainda não atendem nenhum pedido, um que caiba (assim carros reservados antes do pedido, ou sem data, também deixam o pedido com OK).
 */
export function atendimentoDosPedidos(pedidos: readonly ModeloDesejado[], reservas: readonly { id: string; veiculo_id: string; estado: string }[], veiculos: ReadonlyMap<string, Pick<Veiculo, "modelo" | "cor" | "my"> & { blindado?: boolean }>): Map<string, string> {
  const ativas = reservas.filter((r) => r.estado !== "cancelado");
  const quem = new Map<string, string>(); const usados = new Set<string>();
  for (const p of pedidos) { const r = p.reserva_id ? ativas.find((x) => x.id === p.reserva_id) : undefined; if (r) { quem.set(p.id, r.veiculo_id); usados.add(r.veiculo_id); } }
  for (const p of pedidos) {
    if (quem.has(p.id) || p.reserva_id || p.nao_atendido) continue;
    const achou = ativas.find((r) => !usados.has(r.veiculo_id) && veiculos.get(r.veiculo_id) && combina(veiculos.get(r.veiculo_id)!, p));
    if (achou) { quem.set(p.id, achou.veiculo_id); usados.add(achou.veiculo_id); }
  }
  return quem;
}
