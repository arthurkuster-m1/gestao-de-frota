import type { Evento, Reserva } from "../eventos/tipos";
import type { Veiculo } from "../veiculos/tipos";
import { carrosEmVigor, divergenciasDoEvento, vigenciaEmVigor } from "./regras";
import type { Aditivo, AditivoVeiculo, Contrato, ContratoVeiculo } from "./tipos";

export type AlertaDeContrato = { contratoId: string; eventoId: string; eventoNome: string; textos: string[]; veiculoIds: string[]; /** muda quando as divergências mudam (para avisar de novo só quando há novidade) */ assinatura: string };

/**
 * Contratos cujos dados divergem do evento. Contrato "Planejado" não entra: ele ainda acompanha o evento sozinho.
 * Encerrado também não. O resto (enviado, aguardando assinaturas, assinado) avisa.
 */
export function alertasDeContratos(p: { contratos: readonly Contrato[]; carros: readonly ContratoVeiculo[]; aditivos: readonly Aditivo[]; itens: readonly AditivoVeiculo[]; eventos: readonly Evento[]; reservas: readonly Reserva[]; veiculos: readonly Veiculo[]; clientes: ReadonlyMap<string, string> }): AlertaDeContrato[] {
  const vs = new Map(p.veiculos.map((v) => [v.id, v])), es = new Map(p.eventos.map((e) => [e.id, e]));
  const out: AlertaDeContrato[] = [];
  for (const c of p.contratos) {
    if (c.status === "rascunho" || c.status === "encerrado") continue;
    const e = es.get(c.evento_id); if (!e) continue;
    const ads = p.aditivos.filter((a) => a.contrato_id === c.id);
    const vigencia = vigenciaEmVigor(c, ads), carros = carrosEmVigor(p.carros.filter((x) => x.contrato_id === c.id), ads, p.itens);
    const divs = divergenciasDoEvento({ contratoClienteId: c.cliente_id, eventoClienteId: e.cliente_id, vigencia, carros, reservas: p.reservas.filter((r) => r.evento_id === c.evento_id), evento: e, nomeDoCarro: (id) => { const v = vs.get(id); return v ? (v.codigo ?? v.modelo.toUpperCase()) : "?"; }, nomeDoCliente: (id) => p.clientes.get(id) ?? "?" });
    if (divs.length === 0) continue;
    const textos = [...new Set(divs.map((d) => d.texto))];
    out.push({ contratoId: c.id, eventoId: c.evento_id, eventoNome: e.nome, textos, veiculoIds: [...new Set(divs.map((d) => d.veiculoId).filter((x): x is string => !!x))], assinatura: textos.join("|") });
  }
  return out;
}
