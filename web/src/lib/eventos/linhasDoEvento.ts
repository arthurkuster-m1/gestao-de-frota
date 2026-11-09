import type { Transporte, Sentido, Modalidade } from "../transportes/tipos";
import type { Veiculo } from "../veiculos/tipos";
import type { Evento, EventoLocal, ModeloDesejado, Reserva } from "./tipos";

/** Uma linha da tabela de veículos do evento: um carro já definido (reserva) ou um carro PEDIDO ainda sem definição (modelo desejado). */
export type LinhaDoEvento = { key: string; reserva: Reserva | null; pedido: ModeloDesejado | null; veiculo: Veiculo | null };

export const codigoDoVeiculo = (v: Pick<Veiculo, "codigo" | "modelo">) => v.codigo ?? v.modelo.toUpperCase();
/** Sem carro definido, o "código" é o pedido: MODELO + COR + MY. */
export const codigoDoPedido = (p: Pick<ModeloDesejado, "modelo" | "cor" | "my">) => [p.modelo, p.cor, p.my].filter(Boolean).join(" ").toUpperCase();
export const codigoDaLinha = (l: LinhaDoEvento) => (l.veiculo ? codigoDoVeiculo(l.veiculo) : l.pedido ? codigoDoPedido(l.pedido) : "?");

/** Carros definidos (por código) e, depois, os pedidos que ainda não têm carro (na ordem do pedido). Reserva cancelada não aparece. */
export function montarLinhas(eventoId: string, reservas: readonly Reserva[], pedidos: readonly ModeloDesejado[], veiculos: readonly Veiculo[]): LinhaDoEvento[] {
  const porId = new Map(veiculos.map((v) => [v.id, v]));
  const doEvento = reservas.filter((r) => r.evento_id === eventoId && r.estado !== "cancelado");
  const pedidoDaReserva = new Map(pedidos.filter((p) => p.reserva_id).map((p) => [p.reserva_id!, p]));
  const definidas: LinhaDoEvento[] = doEvento.map((r) => ({ key: `r:${r.id}`, reserva: r, pedido: pedidoDaReserva.get(r.id) ?? null, veiculo: porId.get(r.veiculo_id) ?? null }))
    .sort((a, b) => codigoDaLinha(a).localeCompare(codigoDaLinha(b), "pt-BR", { numeric: true }));
  const abertas: LinhaDoEvento[] = pedidos.filter((p) => p.evento_id === eventoId && !p.reserva_id).sort((a, b) => a.posicao - b.posicao)
    .map((p) => ({ key: `p:${p.id}`, reserva: null, pedido: p, veiculo: null }));
  return [...definidas, ...abertas];
}

/** O que cada campo individual vale: o da reserva, se foi individualizado; senão herda do evento. `herdado` diz de onde veio. */
export function valoresEfetivos(l: LinhaDoEvento, evento: Pick<Evento, "status" | "chegada_prevista" | "retirada_prevista">, locais: readonly EventoLocal[]) {
  const r = l.reserva;
  const principal = [...locais].sort((a, b) => a.posicao - b.posicao)[0];
  const enderecoDoEvento = principal ? [principal.endereco, [principal.cidade, principal.estado].filter(Boolean).join("/")].filter(Boolean).join(", ") : null;
  const pega = <T,>(proprio: T | null | undefined, padrao: T | null) => ({ valor: (proprio ?? padrao) as T | null, herdado: proprio == null });
  return {
    status: pega(r?.status_individual, evento.status),
    chegada: pega(r?.chegada, evento.chegada_prevista),
    retirada: pega(r?.retirada, evento.retirada_prevista),
    enderecoChegada: pega(r?.endereco_chegada, enderecoDoEvento),
    origem: pega(r?.origem, null),
  };
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Tabela pequena para colar no Outlook: 1ª linha os títulos, depois "Código | Placa | VIN | Modelo | Cor | MY". Devolve HTML (Outlook) e texto tabulado (Excel/bloco de notas). */
export function tabelaParaOutlook(linhas: readonly LinhaDoEvento[]): { html: string; texto: string } {
  const titulos = ["Código", "Placa", "VIN", "Modelo", "Cor", "MY"];
  const dados = linhas.filter((l) => l.veiculo).map((l) => { const v = l.veiculo!; return [codigoDoVeiculo(v), v.placa ?? "", v.vin ?? "", v.modelo, v.cor ?? "", v.my ?? ""]; });
  const cel = (t: string, th: boolean) => `<${th ? "th" : "td"} style="border:1px solid #999;padding:4px 8px;text-align:left;${th ? "background:#eee;font-weight:bold;" : ""}">${esc(t)}</${th ? "th" : "td"}>`;
  const html = `<table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt"><tr>${titulos.map((t) => cel(t, true)).join("")}</tr>${dados.map((r) => `<tr>${r.map((t) => cel(t, false)).join("")}</tr>`).join("")}</table>`;
  return { html, texto: [titulos, ...dados].map((r) => r.join("\t")).join("\n") };
}

/** Acha um transporte já cadastrado no evento com a mesma referência (nº da PTA…), sentido e modalidade: vários carros dividem o mesmo. */
export function acharTransporte(transportes: readonly Transporte[], eventoId: string, sentido: Sentido, modalidade: Modalidade, referencia: string | null | undefined): Transporte | null {
  const ref = (referencia ?? "").trim().toLowerCase();
  if (!ref) return null;
  return transportes.find((t) => t.evento_id === eventoId && t.sentido === sentido && t.modalidade === modalidade && (t.referencia ?? "").trim().toLowerCase() === ref) ?? null;
}
/** Custo planejado dos transportes do evento (cada transporte conta UMA vez, mesmo com vários carros nele) e quantos são. */
export function custoDoEvento(transportes: readonly Transporte[], eventoId: string): { total: number; quantidade: number } {
  const ts = transportes.filter((t) => t.evento_id === eventoId);
  return { total: ts.reduce((s, t) => s + (t.valor_planejado ?? 0), 0), quantidade: ts.length };
}
