import { supabase } from "../supabase";
import type { AnotacaoDoCarro, AnotacaoNova, EstadoReserva, Evento, EventoLocal, EventoLocalNovo, EventoNovo, ModeloDesejado, ModeloDesejadoNovo, Reserva } from "./tipos";

export class ErroEvento extends Error {}
function traduzir(e: { code?: string; message: string }): ErroEvento {
  if (/eventos|evento_veiculos/.test(e.message) && /schema cache|does not exist/.test(e.message)) return new ErroEvento("Eventos e reservas ainda não foram ativados no banco (falta aplicar a migration 0006).");
  if (e.code === "23505") return new ErroEvento(/evento_veiculos_evento_id_veiculo_id/.test(e.message) ? "Esse carro já está nesse evento." : "Já existe um evento com esse nome.");
  if (e.code === "23514") return new ErroEvento(/janela_check/.test(e.message) ? "A chegada e a retirada precisam ficar dentro do período da reserva, nessa ordem." : /evento_locais/.test(e.message) ? "O endereço não pode ficar vazio (e o estado é a sigla, como SP)." : /reserva_fim|check/.test(e.message) ? "A data final não pode ser antes da inicial." : "Algum campo está inválido.");
  if (e.code === "23503") return new ErroEvento("O veículo ou o evento não existe mais.");
  if (e.code === "42501") return new ErroEvento("Sem permissão. Entre de novo na conta.");
  return new ErroEvento(e.message);
}
const COLUNAS_EVENTO = "id, nome, tipo, status, solicitante, comentarios, created_at, chegada_prevista, retirada_prevista, contato, cliente_id";
const COLUNAS_RESERVA = "id, evento_id, veiculo_id, reserva_inicio, reserva_fim, chegada, retirada, estado, comentarios, origem, endereco_chegada, status_individual";
const COLUNAS_RESERVA_ANTIGAS = "id, evento_id, veiculo_id, reserva_inicio, reserva_fim, estado, comentarios, origem, endereco_chegada, status_individual";
const COLUNAS_LOCAL = "id, evento_id, rotulo, endereco, cidade, estado, posicao";

export async function listarEventos(): Promise<Evento[]> {
  const { data, error } = await supabase.from("eventos").select(COLUNAS_EVENTO).order("created_at", { ascending: false }).limit(2000);
  if (error) throw traduzir(error);
  return (data ?? []) as Evento[];
}
export async function listarReservas(): Promise<Reserva[]> {
  const { data, error } = await supabase.from("evento_veiculos").select(COLUNAS_RESERVA).order("reserva_inicio", { ascending: true }).limit(10000);
  if (!error) return (data ?? []) as Reserva[];
  // migration 0007 (chegada/retirada) ainda não aplicada: lê sem essas colunas, para Status de uso e Agenda seguirem funcionando
  if (/chegada|retirada/.test(error.message)) {
    const antigo = await supabase.from("evento_veiculos").select(COLUNAS_RESERVA_ANTIGAS).order("reserva_inicio", { ascending: true }).limit(10000);
    if (antigo.error) throw traduzir(antigo.error);
    return ((antigo.data ?? []) as Omit<Reserva, "chegada" | "retirada">[]).map((r) => ({ ...r, chegada: null, retirada: null }));
  }
  throw traduzir(error);
}
export async function criarEvento(e: EventoNovo): Promise<Evento> {
  const { data, error } = await supabase.from("eventos").insert({ ...e, nome: e.nome.trim() }).select(COLUNAS_EVENTO).single();
  if (error) throw traduzir(error);
  return data as Evento;
}
export async function atualizarEvento(id: string, patch: Partial<EventoNovo>): Promise<Evento> {
  const { data, error } = await supabase.from("eventos").update(patch).eq("id", id).select(COLUNAS_EVENTO).single();
  if (error) throw traduzir(error);
  return data as Evento;
}
export async function excluirEvento(id: string): Promise<void> {
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) throw traduzir(error);
}
const SEM_COLUNAS_NOVAS = /chegada|retirada/;
const comNulos = (r: Omit<Reserva, "chegada" | "retirada">): Reserva => ({ ...r, chegada: null, retirada: null });

/** Reserva vários carros de uma vez no mesmo período. Tudo ou nada. */
export async function reservarVeiculos(eventoId: string, veiculoIds: string[], inicio: string, fim: string, estado: EstadoReserva = "reservado", janela: { chegada?: string | null; retirada?: string | null } = {}): Promise<Reserva[]> {
  if (veiculoIds.length === 0) return [];
  const base = veiculoIds.map((veiculo_id) => ({ evento_id: eventoId, veiculo_id, reserva_inicio: inicio, reserva_fim: fim, estado }));
  const completo = base.map((l) => ({ ...l, ...(janela.chegada ? { chegada: janela.chegada } : {}), ...(janela.retirada ? { retirada: janela.retirada } : {}) }));
  const { data, error } = await supabase.from("evento_veiculos").insert(completo).select(COLUNAS_RESERVA);
  if (!error) return (data ?? []) as Reserva[];
  if (SEM_COLUNAS_NOVAS.test(error.message) && !janela.chegada && !janela.retirada) {   // migration 0007 ainda não aplicada
    const antigo = await supabase.from("evento_veiculos").insert(base).select(COLUNAS_RESERVA_ANTIGAS);
    if (antigo.error) throw traduzir(antigo.error);
    return ((antigo.data ?? []) as Omit<Reserva, "chegada" | "retirada">[]).map(comNulos);
  }
  throw SEM_COLUNAS_NOVAS.test(error.message) ? new ErroEvento("Chegada e retirada ainda não foram ativadas no banco (falta aplicar a migration 0007).") : traduzir(error);
}
export async function atualizarReserva(id: string, patch: Partial<Pick<Reserva, "reserva_inicio" | "reserva_fim" | "chegada" | "retirada" | "estado" | "comentarios" | "origem" | "endereco_chegada" | "status_individual">>): Promise<Reserva> {
  const { data, error } = await supabase.from("evento_veiculos").update(patch).eq("id", id).select(COLUNAS_RESERVA).single();
  if (!error) return data as Reserva;
  if (SEM_COLUNAS_NOVAS.test(error.message) && !("chegada" in patch) && !("retirada" in patch)) {   // migration 0007 ainda não aplicada
    const antigo = await supabase.from("evento_veiculos").update(patch).eq("id", id).select(COLUNAS_RESERVA_ANTIGAS).single();
    if (antigo.error) throw traduzir(antigo.error);
    return comNulos(antigo.data as Omit<Reserva, "chegada" | "retirada">);
  }
  throw SEM_COLUNAS_NOVAS.test(error.message) ? new ErroEvento("Chegada e retirada ainda não foram ativadas no banco (falta aplicar a migration 0007).") : traduzir(error);
}
export async function removerReserva(id: string): Promise<void> {
  const { error } = await supabase.from("evento_veiculos").delete().eq("id", id);
  if (error) throw traduzir(error);
}

/** Várias reservas de uma vez (ex.: mover o evento inteiro na linha do tempo). Uma por vez; se uma falhar, as anteriores já foram. */
export async function atualizarReservas(ids: string[], patchDe: (id: string) => Partial<Pick<Reserva, "reserva_inicio" | "reserva_fim" | "chegada" | "retirada">>): Promise<Reserva[]> {
  const salvas: Reserva[] = [];
  for (const id of ids) salvas.push(await atualizarReserva(id, patchDe(id)));
  return salvas;
}

export async function listarLocais(): Promise<EventoLocal[]> {
  const { data, error } = await supabase.from("evento_locais").select(COLUNAS_LOCAL).order("posicao", { ascending: true }).limit(10000);
  if (error) throw traduzir(error);
  return (data ?? []) as EventoLocal[];
}
export async function criarLocais(eventoId: string, locais: EventoLocalNovo[], primeiraPosicao = 0): Promise<EventoLocal[]> {
  const validos = locais.filter((l) => l.endereco.trim() !== "");
  if (validos.length === 0) return [];
  const linhas = validos.map((l, i) => ({ evento_id: eventoId, rotulo: l.rotulo?.trim() || null, endereco: l.endereco.trim(), cidade: l.cidade?.trim() || null, estado: l.estado ? l.estado.toUpperCase() : null, posicao: primeiraPosicao + i }));
  const { data, error } = await supabase.from("evento_locais").insert(linhas).select(COLUNAS_LOCAL);
  if (error) throw traduzir(error);
  return (data ?? []) as EventoLocal[];
}
export async function atualizarLocal(id: string, patch: Partial<EventoLocalNovo>): Promise<EventoLocal> {
  const { data, error } = await supabase.from("evento_locais").update(patch).eq("id", id).select(COLUNAS_LOCAL).single();
  if (error) throw traduzir(error);
  return data as EventoLocal;
}
export async function removerLocal(id: string): Promise<void> {
  const { error } = await supabase.from("evento_locais").delete().eq("id", id);
  if (error) throw traduzir(error);
}

// ---------- modelos desejados do evento ----------
const COLUNAS_DESEJADO = "id, evento_id, modelo, versao, cor, my, reserva_id, nao_atendido, nota, posicao";
const limpo = (t: string | null | undefined) => { const x = (t ?? "").trim(); return x === "" ? null : x; };

export async function listarDesejados(): Promise<ModeloDesejado[]> {
  const { data, error } = await supabase.from("evento_modelos_desejados").select(COLUNAS_DESEJADO).order("posicao", { ascending: true }).limit(10000);
  if (error) throw traduzir(error);
  return (data ?? []) as ModeloDesejado[];
}
/** Cria uma linha por carro pedido (`quantidade` carros iguais viram linhas iguais). */
export async function criarDesejados(eventoId: string, itens: (ModeloDesejadoNovo & { quantidade?: number })[], primeiraPosicao = 0): Promise<ModeloDesejado[]> {
  const linhas = itens.filter((i) => limpo(i.modelo)).flatMap((i) => Array.from({ length: Math.max(1, Math.min(50, i.quantidade ?? 1)) }, () => ({ modelo: i.modelo.trim(), cor: limpo(i.cor), my: limpo(i.my) })))
    .map((l, k) => ({ ...l, evento_id: eventoId, posicao: primeiraPosicao + k }));
  if (linhas.length === 0) return [];
  const { data, error } = await supabase.from("evento_modelos_desejados").insert(linhas).select(COLUNAS_DESEJADO);
  if (error) throw traduzir(error);
  return (data ?? []) as ModeloDesejado[];
}
export async function atualizarDesejado(id: string, patch: Partial<Pick<ModeloDesejado, "reserva_id" | "nao_atendido" | "nota">>): Promise<ModeloDesejado> {
  const { data, error } = await supabase.from("evento_modelos_desejados").update(patch).eq("id", id).select(COLUNAS_DESEJADO).single();
  if (error) throw traduzir(error);
  return data as ModeloDesejado;
}
export async function removerDesejado(id: string): Promise<void> {
  const { error } = await supabase.from("evento_modelos_desejados").delete().eq("id", id);
  if (error) throw traduzir(error);
}

// ---------- anotações do carro ----------
const COLUNAS_ANOTACAO = "id, veiculo_id, titulo, inicio, fim, comentarios";
export async function listarAnotacoes(): Promise<AnotacaoDoCarro[]> {
  const { data, error } = await supabase.from("veiculo_anotacoes").select(COLUNAS_ANOTACAO).order("inicio", { ascending: true }).limit(10000);
  if (error) throw traduzir(error);
  return (data ?? []) as AnotacaoDoCarro[];
}
export async function criarAnotacao(a: AnotacaoNova): Promise<AnotacaoDoCarro> {
  const { data, error } = await supabase.from("veiculo_anotacoes").insert({ ...a, titulo: a.titulo.trim(), comentarios: limpo(a.comentarios) }).select(COLUNAS_ANOTACAO).single();
  if (error) throw traduzir(error);
  return data as AnotacaoDoCarro;
}
export async function atualizarAnotacao(id: string, patch: Partial<Pick<AnotacaoDoCarro, "titulo" | "inicio" | "fim" | "comentarios">>): Promise<AnotacaoDoCarro> {
  const { data, error } = await supabase.from("veiculo_anotacoes").update(patch).eq("id", id).select(COLUNAS_ANOTACAO).single();
  if (error) throw traduzir(error);
  return data as AnotacaoDoCarro;
}
export async function removerAnotacao(id: string): Promise<void> {
  const { error } = await supabase.from("veiculo_anotacoes").delete().eq("id", id);
  if (error) throw traduzir(error);
}
