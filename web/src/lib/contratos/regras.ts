import type { Reserva } from "../eventos/tipos";
import type { Aditivo, AditivoVeiculo, Contrato, ContratoVeiculo } from "./tipos";

const assinados = (aditivos: readonly Aditivo[]) => aditivos.filter((a) => a.status === "assinado").sort((a, b) => (a.assinado_em ?? "").localeCompare(b.assinado_em ?? "") || a.created_at.localeCompare(b.created_at));

/** A vigência EM VIGOR: o fim da última extensão de prazo ASSINADA, ou o fim do contrato se não houver. Aditivo ainda não assinado não vale. */
export function vigenciaEmVigor(contrato: Pick<Contrato, "vigencia_inicio" | "vigencia_fim">, aditivos: readonly Aditivo[]): { inicio: string | null; fim: string | null } {
  const ext = assinados(aditivos).filter((a) => a.tipo === "extensao_prazo" && a.vigencia_fim_nova);
  return { inicio: contrato.vigencia_inicio, fim: ext.length ? ext.at(-1)!.vigencia_fim_nova : contrato.vigencia_fim };
}

/** Os carros EM VIGOR: os do contrato, menos os que saíram e mais os que entraram nas trocas ASSINADAS (em ordem). */
export function carrosEmVigor(carros: readonly Pick<ContratoVeiculo, "veiculo_id">[], aditivos: readonly Aditivo[], itens: readonly AditivoVeiculo[]): Set<string> {
  const set = new Set(carros.map((c) => c.veiculo_id));
  for (const a of assinados(aditivos).filter((x) => x.tipo === "troca_carros")) {
    const doAditivo = itens.filter((i) => i.aditivo_id === a.id);
    for (const i of doAditivo) if (i.acao === "sai") set.delete(i.veiculo_id);
    for (const i of doAditivo) if (i.acao === "entra") set.add(i.veiculo_id);
  }
  return set;
}

export type Divergencia = { tipo: "carro_sem_contrato" | "carro_sem_reserva" | "fora_da_vigencia" | "evento_fora_da_vigencia" | "cliente"; veiculoId: string | null; texto: string };

/**
 * Conferência do contrato com o evento. Compara os carros e as datas das reservas (não canceladas) com os carros e a vigência EM VIGOR:
 *  - carro reservado que o contrato não cobre; carro do contrato sem reserva;
 *  - reserva que começa antes ou termina depois da vigência (conta da chegada à retirada; sem elas, o período da reserva).
 */
export function divergencias(emVigor: ReadonlySet<string>, vigencia: { inicio: string | null; fim: string | null }, reservas: readonly Reserva[], nomeDoCarro: (id: string) => string): Divergencia[] {
  const ativas = reservas.filter((r) => r.estado !== "cancelado");
  const out: Divergencia[] = [];
  const reservados = new Set(ativas.map((r) => r.veiculo_id));
  for (const r of ativas) if (!emVigor.has(r.veiculo_id)) out.push({ tipo: "carro_sem_contrato", veiculoId: r.veiculo_id, texto: `${nomeDoCarro(r.veiculo_id)} está reservado no evento mas não consta no contrato.` });
  for (const id of emVigor) if (!reservados.has(id)) out.push({ tipo: "carro_sem_reserva", veiculoId: id, texto: `${nomeDoCarro(id)} consta no contrato mas não está reservado no evento.` });
  for (const r of ativas) {
    const ini = r.chegada ?? r.reserva_inicio, fim = r.retirada ?? r.reserva_fim;
    if (vigencia.fim && fim > vigencia.fim) out.push({ tipo: "fora_da_vigencia", veiculoId: r.veiculo_id, texto: `${nomeDoCarro(r.veiculo_id)} fica até ${br(fim)}, depois do fim da vigência (${br(vigencia.fim)}).` });
    else if (vigencia.inicio && ini < vigencia.inicio) out.push({ tipo: "fora_da_vigencia", veiculoId: r.veiculo_id, texto: `${nomeDoCarro(r.veiculo_id)} chega em ${br(ini)}, antes do início da vigência (${br(vigencia.inicio)}).` });
  }
  return out;
}
const br = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** A vigência sugerida para um contrato novo: da primeira chegada à última retirada das reservas do evento. */
export function vigenciaSugerida(reservas: readonly Reserva[]): { inicio: string | null; fim: string | null } {
  const ativas = reservas.filter((r) => r.estado !== "cancelado"); if (!ativas.length) return { inicio: null, fim: null };
  return { inicio: ativas.map((r) => r.chegada ?? r.reserva_inicio).sort()[0]!, fim: ativas.map((r) => r.retirada ?? r.reserva_fim).sort().at(-1)! };
}

/**
 * "Dados divergentes": o que o EVENTO é hoje contra o que o contrato diz. Soma à conferência de carros e datas das reservas o cliente
 * (o do evento mudou) e as datas do próprio evento fora da vigência. Depois de assinado, nada disso muda o contrato: vira aditivo.
 */
export function divergenciasDoEvento(p: { contratoClienteId: string; eventoClienteId: string | null | undefined; vigencia: { inicio: string | null; fim: string | null }; carros: ReadonlySet<string>; reservas: readonly Reserva[]; evento: { chegada_prevista: string | null; retirada_prevista: string | null }; nomeDoCarro: (id: string) => string; nomeDoCliente?: (id: string) => string }): Divergencia[] {
  const out = divergencias(p.carros, p.vigencia, p.reservas, p.nomeDoCarro);
  if (p.eventoClienteId && p.eventoClienteId !== p.contratoClienteId) out.push({ tipo: "cliente", veiculoId: null, texto: `O cliente do evento (${p.nomeDoCliente?.(p.eventoClienteId) ?? "outro"}) não é o do contrato (${p.nomeDoCliente?.(p.contratoClienteId) ?? "?"}).` });
  const { chegada_prevista: ini, retirada_prevista: fim } = p.evento;
  if (fim && p.vigencia.fim && fim > p.vigencia.fim) out.push({ tipo: "evento_fora_da_vigencia", veiculoId: null, texto: `O evento termina em ${br(fim)}, depois do fim da vigência (${br(p.vigencia.fim)}).` });
  if (ini && p.vigencia.inicio && ini < p.vigencia.inicio) out.push({ tipo: "evento_fora_da_vigencia", veiculoId: null, texto: `O evento começa em ${br(ini)}, antes do início da vigência (${br(p.vigencia.inicio)}).` });
  return out;
}

/** O que cada divergência pede: extensão de prazo (novo fim) e/ou troca de carros (quais saem, quais entram). */
export function planoDeAditivos(p: { vigenciaFim: string | null; carros: ReadonlySet<string>; reservas: readonly Reserva[]; evento: { retirada_prevista: string | null } }): { novoFim: string | null; sai: string[]; entra: string[] } {
  const rs = p.reservas.filter((r) => r.estado !== "cancelado");
  const fins = [p.evento.retirada_prevista, ...rs.map((r) => r.retirada ?? r.reserva_fim)].filter((x): x is string => !!x).sort();
  const maior = fins.at(-1) ?? null;
  const reservados = new Set(rs.map((r) => r.veiculo_id));
  return { novoFim: maior && p.vigenciaFim && maior > p.vigenciaFim ? maior : null, sai: [...p.carros].filter((id) => !reservados.has(id)), entra: [...reservados].filter((id) => !p.carros.has(id)) };
}
