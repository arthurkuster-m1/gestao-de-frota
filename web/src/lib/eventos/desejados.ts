import { partirModelo } from "../veiculos/modelo";
import type { Veiculo } from "../veiculos/tipos";
import type { ModeloDesejado } from "./tipos";

const k = (t: string | null | undefined) => (t ?? "").trim().toLowerCase();

/** O carro cabe no pedido? Modelo mãe sempre; versão, cor e MY só se foram informados. Sem diferenciar maiúsculas. */
export function combina(v: Pick<Veiculo, "modelo" | "cor" | "my">, d: Pick<ModeloDesejado, "modelo" | "versao" | "cor" | "my">): boolean {
  const { mae, versao } = partirModelo(v.modelo);
  if (k(mae) !== k(d.modelo)) return false;
  if (d.versao && k(versao) !== k(d.versao)) return false;
  if (d.cor && k(v.cor) !== k(d.cor)) return false;
  if (d.my && k(v.my) !== k(d.my)) return false;
  return true;
}

/** "S10 TRAILBOSS PITCH · Branco · 2027" */
export const rotuloDoDesejado = (d: Pick<ModeloDesejado, "modelo" | "versao" | "cor" | "my">) => [[d.modelo, d.versao].filter(Boolean).join(" "), d.cor, d.my].filter(Boolean).join(" · ");

/** O carro cabe em algum dos pedidos ainda em aberto (nem atendido nem marcado como indisponível)? Sem pedidos em aberto, qualquer carro serve. */
export function cabeNosPedidos(v: Pick<Veiculo, "modelo" | "cor" | "my">, pedidos: readonly ModeloDesejado[]): boolean {
  const abertos = pedidos.filter((p) => !p.reserva_id && !p.nao_atendido);
  return abertos.length === 0 || abertos.some((p) => combina(v, p));
}

/** Primeiro pedido em aberto que o carro atende (para ligar a reserva ao pedido). */
export const pedidoQueAtende = (v: Pick<Veiculo, "modelo" | "cor" | "my">, pedidos: readonly ModeloDesejado[]) => pedidos.find((p) => !p.reserva_id && !p.nao_atendido && combina(v, p));
