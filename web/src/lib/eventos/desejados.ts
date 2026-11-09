import type { Veiculo } from "../veiculos/tipos";
import type { ModeloDesejado } from "./tipos";

const k = (t: string | null | undefined) => (t ?? "").trim().toLowerCase();

const norm = (t: string | null | undefined) => (t ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** O carro cabe no pedido? O modelo pedido ("S10", "S10 TRAILBOSS PITCH") tem de ser o começo do modelo do carro, palavra por palavra; cor e MY só se foram informados. Sem diferenciar maiúsculas. */
export function combina(v: Pick<Veiculo, "modelo" | "cor" | "my">, d: Pick<ModeloDesejado, "modelo" | "cor" | "my">): boolean {
  const vm = norm(v.modelo), dm = norm(d.modelo);
  if (dm === "" || !(vm === dm || vm.startsWith(dm + " "))) return false;
  if (d.cor && norm(v.cor) !== norm(d.cor)) return false;
  if (d.my && norm(v.my) !== norm(d.my)) return false;
  return true;
}

/** "S10 TRAILBOSS PITCH · Branco · 2027" */
export const rotuloDoDesejado = (d: Pick<ModeloDesejado, "modelo" | "cor" | "my">) => [d.modelo, d.cor, d.my].filter(Boolean).join(" · ");

/** O carro cabe em algum dos pedidos ainda em aberto (nem atendido nem marcado como indisponível)? Sem pedidos em aberto, qualquer carro serve. */
export function cabeNosPedidos(v: Pick<Veiculo, "modelo" | "cor" | "my">, pedidos: readonly ModeloDesejado[]): boolean {
  const abertos = pedidos.filter((p) => !p.reserva_id && !p.nao_atendido);
  return abertos.length === 0 || abertos.some((p) => combina(v, p));
}

/** Primeiro pedido em aberto que o carro atende (para ligar a reserva ao pedido). */
export const pedidoQueAtende = (v: Pick<Veiculo, "modelo" | "cor" | "my">, pedidos: readonly ModeloDesejado[]) => pedidos.find((p) => !p.reserva_id && !p.nao_atendido && combina(v, p));
