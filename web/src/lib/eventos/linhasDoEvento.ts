import type { Transporte, Sentido, Modalidade } from "../transportes/tipos";
import type { Veiculo } from "../veiculos/tipos";
import type { Evento, EventoLocal, ModeloDesejado, ReservaDoEvento, StatusEvento } from "./tipos";

/** Uma linha da tabela de veículos do evento: um carro já definido (reserva) ou um carro PEDIDO ainda sem definição (modelo desejado). */
export type LinhaDoEvento = { key: string; reserva: ReservaDoEvento | null; pedido: ModeloDesejado | null; veiculo: Veiculo | null };

export const codigoDoVeiculo = (v: Pick<Veiculo, "codigo" | "modelo">) => v.codigo ?? v.modelo.toUpperCase();
/** Sem carro definido, o "código" é o pedido: MODELO + COR + MY. */
export const codigoDoPedido = (p: Pick<ModeloDesejado, "modelo" | "cor" | "my">) => [p.modelo, p.cor, p.my].filter(Boolean).join(" ").toUpperCase();
export const codigoDaLinha = (l: LinhaDoEvento) => (l.veiculo ? codigoDoVeiculo(l.veiculo) : l.pedido ? codigoDoPedido(l.pedido) : "?");

/** Carros definidos (por código) e, depois, os pedidos que ainda não têm carro (na ordem do pedido). Reserva cancelada não aparece. */
export function montarLinhas(eventoId: string, reservas: readonly ReservaDoEvento[], pedidos: readonly ModeloDesejado[], veiculos: readonly Veiculo[]): LinhaDoEvento[] {
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
/** Sem status próprio, o carro mostra a situação DELE (checklist de saída = Em uso, de retorno = Concluído) e só herda o status do evento enquanto está apenas reservado. */
export function statusPelaReserva(estado: string | undefined, doEvento: StatusEvento): StatusEvento {
  if (estado === "concluido") return "concluido";
  if (estado === "em_retorno") return "solicitar_retorno";
  if (estado === "em_uso") return "em_uso";
  return doEvento;
}
export function valoresEfetivos(l: LinhaDoEvento, evento: Pick<Evento, "status" | "chegada_prevista" | "retirada_prevista"> & { origem?: string | null; envio_previsto?: string | null; retorno_previsto?: string | null }, locais: readonly EventoLocal[]) {
  const r = l.reserva;
  const principal = locais.filter((l) => l.tipo !== "origem").sort((a, b) => a.posicao - b.posicao)[0];
  const enderecoDoEvento = principal ? principal.endereco : null;   // já é a linha completa (rua, número - cidade/UF - CEP)
  const pega = <T,>(proprio: T | null | undefined, padrao: T | null) => ({ valor: (proprio ?? padrao) as T | null, herdado: proprio == null });
  return {
    status: pega(r?.status_individual, statusPelaReserva(r?.estado, evento.status)),
    envio: pega(r?.envio, evento.envio_previsto ?? null),
    chegada: pega(r?.chegada, evento.chegada_prevista),
    retirada: pega(r?.retirada, evento.retirada_prevista),
    retorno: pega(r?.retorno, evento.retorno_previsto ?? null),
    enderecoChegada: pega(r?.endereco_chegada, enderecoDoEvento),
    origem: pega(r?.origem, evento.origem ?? null),
    /** Para onde o carro volta: o endereço de retorno dele; sem isso, volta para a origem (do carro ou do evento). */
    enderecoRetorno: pega(r?.endereco_retorno, r?.origem ?? evento.origem ?? null),
  };
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/**
 * Tabela pequena para colar no Outlook: 1ª linha os títulos (azul, letra branca), depois "Código | Placa | VIN | Modelo | Cor | MY".
 * Devolve HTML (Outlook) e texto tabulado (Excel/bloco de notas).
 */
export function tabelaDeVeiculosParaOutlook(veiculos: readonly Veiculo[]): { html: string; texto: string } {
  const titulos = ["Código", "Placa", "VIN", "Modelo", "Cor", "MY"];
  const dados = veiculos.map((v) => [codigoDoVeiculo(v), v.placa ?? "", v.vin ?? "", v.modelo, v.cor ?? "", v.my ?? ""]);
  const base = "border:1px solid #000;padding:2px 8px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:11pt;";
  const cel = (t: string, th: boolean) => `<${th ? "th" : "td"} style="${base}${th ? "background:#4472C4;color:#fff;font-weight:bold;" : ""}">${esc(t)}</${th ? "th" : "td"}>`;
  const html = `<table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt"><tr>${titulos.map((t) => cel(t, true)).join("")}</tr>${dados.map((r) => `<tr>${r.map((t) => cel(t, false)).join("")}</tr>`).join("")}</table>`;
  return { html, texto: [titulos, ...dados].map((r) => r.join("\t")).join("\n") };
}
export const tabelaParaOutlook = (linhas: readonly LinhaDoEvento[]) => tabelaDeVeiculosParaOutlook(linhas.filter((l) => l.veiculo).map((l) => l.veiculo!));

/** Copia a tabela para a área de transferência (HTML para o Outlook + texto para o Excel). Devolve false se o navegador não deixou. */
export async function copiarTabela(t: { html: string; texto: string }): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([t.html], { type: "text/html" }), "text/plain": new Blob([t.texto], { type: "text/plain" }) })]);
    else await navigator.clipboard.writeText(t.texto);
    return true;
  } catch { return false; }
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
