import { buscarCliente } from "../clientes/dados";
import { valoresEfetivos } from "../eventos/linhasDoEvento";
import type { Evento, EventoLocal, Reserva } from "../eventos/tipos";
import type { Veiculo } from "../veiculos/tipos";
import { dadosDoCliente, type CarroDoDocumento, type SnapshotDoAditivo, type SnapshotDoContrato } from "./documentos";
import type { Aditivo, Contrato } from "./tipos";

const ativas = (rs: readonly Reserva[]) => rs.filter((r) => r.estado !== "cancelado");

/** A vigência do contrato SEMPRE engloba o evento: do começo do evento (ou da primeira chegada de carro) ao fim (ou à última retirada). */
export function vigenciaDoEvento(evento: Pick<Evento, "chegada_prevista" | "retirada_prevista">, reservas: readonly Reserva[]): { inicio: string | null; fim: string | null } {
  const rs = ativas(reservas);
  const inicios = [evento.chegada_prevista, ...rs.map((r) => r.chegada ?? r.reserva_inicio)].filter((x): x is string => !!x).sort();
  const fins = [evento.retirada_prevista, ...rs.map((r) => r.retirada ?? r.reserva_fim)].filter((x): x is string => !!x && !x.startsWith("9999")).sort();   // reserva em aberto não tem fim
  return { inicio: inicios[0] ?? null, fim: fins.at(-1) ?? null };
}

export const carroDoDocumento = (v: Veiculo | undefined): CarroDoDocumento => ({ codigo: v ? (v.codigo ?? v.modelo.toUpperCase()) : "?", modelo: [v?.modelo, v?.my].filter(Boolean).join(" "), vin: v?.vin ?? "", cor: v?.cor ?? "", placa: v?.placa ?? "" });

export type EntradaDoSnapshot = { evento: Evento; clienteId: string; veiculos: ReadonlyMap<string, Veiculo>; carroIds: readonly string[]; reservas: readonly Reserva[]; locais: readonly EventoLocal[]; vigencia: { inicio: string | null; fim: string | null } };
export async function montarSnapshotDoContrato(e: EntradaDoSnapshot): Promise<SnapshotDoContrato> {
  const cliente = await buscarCliente(e.clienteId); if (!cliente) throw new Error("Cliente não encontrado.");
  // só as reservas e os locais DESTE evento (quem chama pode passar a lista de todos os eventos: pegar o primeiro local dela traria o endereço de outro evento)
  const principal = e.reservas.find((r) => r.evento_id === e.evento.id && r.estado !== "cancelado");
  const local = valoresEfetivos({ reserva: principal } as never, e.evento, e.locais.filter((l) => l.evento_id === e.evento.id)).enderecoChegada.valor ?? "";
  return {
    evento: e.evento.nome, cliente: dadosDoCliente(cliente), dataInicio: e.vigencia.inicio, dataFim: e.vigencia.fim, objetivo: `uso no evento ${e.evento.nome}`, localEndereco: local,
    carros: e.carroIds.map((id) => carroDoDocumento(e.veiculos.get(id))),
    motoristas: cliente.motoristas.map((m) => ({ nome: m.nome, cpf: m.cpf, cnh: m.cnh_registro, cnhValidade: m.cnh_validade ? m.cnh_validade.slice(0, 10).split("-").reverse().join("/") : "" })),
    geradoEm: new Date().toISOString(),
  };
}

export async function montarSnapshotDoAditivo(e: { contrato: Contrato; aditivo: Pick<Aditivo, "tipo" | "data_efeito" | "vigencia_fim_nova">; numero: number; veiculos: ReadonlyMap<string, Veiculo>; sai: readonly string[]; entra: readonly string[]; cliente?: SnapshotDoContrato["cliente"] }): Promise<SnapshotDoAditivo> {
  const cliente = e.cliente ?? (e.contrato.snapshot as unknown as SnapshotDoContrato | null)?.cliente ?? dadosDoCliente((await buscarCliente(e.contrato.cliente_id))!);
  return { ordinal: e.numero, cliente, dataAssinatura: e.contrato.assinado_em, dataEfeito: e.aditivo.data_efeito, novaDataFim: e.aditivo.vigencia_fim_nova, sai: e.sai.map((id) => carroDoDocumento(e.veiculos.get(id))), entra: e.entra.map((id) => carroDoDocumento(e.veiculos.get(id))) };
}
