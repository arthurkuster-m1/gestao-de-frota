import { SEM_FIM } from "./tipos";
import { supabase } from "../supabase";
import { cidadeEUf } from "../enderecos";
import { paraNumero } from "../transportes/regras";
import type { ReservaDoEvento, AnotacaoDoCarro, AnotacaoNova, EstadoReserva, Evento, EventoLocal, EventoLocalNovo, EventoNovo, ModeloDesejado, ModeloDesejadoNovo, Reserva } from "./tipos";

export class ErroEvento extends Error {}
function traduzir(e: { code?: string; message: string }): ErroEvento {
  if (/eventos|evento_veiculos/.test(e.message) && /schema cache|does not exist/.test(e.message)) return new ErroEvento("Eventos e reservas ainda não foram ativados no banco (falta aplicar a migration 0006).");
  if (/contato_origem|contato_retorno|custos_extras|envio_previsto|retorno_previsto|distancia_ida_km|distancia_volta_km/.test(e.message) && /schema cache|does not exist|column/.test(e.message)) return new ErroEvento("Esses dados do evento ainda não foram ativados no banco (faltam as migrations 0024 e 0026).");
  if (/endereco_retorno|envio|retorno/.test(e.message) && /schema cache|does not exist|column/.test(e.message)) return new ErroEvento("O endereço de retorno e as datas de envio/retorno ainda não foram ativados no banco (faltam as migrations 0023 e 0024).");
  if (/tipo/.test(e.message) && /schema cache|does not exist|column/.test(e.message)) return new ErroEvento("Várias origens ainda não foram ativadas no banco (falta aplicar a migration 0022).");
  if (e.code === "23505") return new ErroEvento(/evento_veiculos_evento_id_veiculo_id/.test(e.message) ? "Esse carro já está nesse evento." : "Já existe um evento com esse nome.");
  if (e.code === "23514") return new ErroEvento(/janela_check/.test(e.message) ? "A chegada e a retirada precisam ficar dentro do período da reserva, nessa ordem." : /evento_locais/.test(e.message) ? "O endereço não pode ficar vazio (e o estado é a sigla, como SP)." : /reserva_fim|check/.test(e.message) ? "A data final não pode ser antes da inicial." : "Algum campo está inválido.");
  if (e.code === "23503") return new ErroEvento("O veículo ou o evento não existe mais.");
  if (e.code === "42501") return new ErroEvento("Sem permissão. Entre de novo na conta.");
  return new ErroEvento(e.message);
}
const COLUNAS_EVENTO_BASE = "id, nome, tipo, status, solicitante, comentarios, created_at, chegada_prevista, retirada_prevista, contato, cliente_id, origem";
/**
 * Colunas do evento que dependem de migrations novas (0024: envio/retorno/km; 0026: contatos, retorno e custos extras): se o banco reclamar de
 * um grupo, lemos sem ele por 20 s (e tentamos de novo depois, sem precisar recarregar a página). O resto do app segue.
 */
const GRUPOS_DO_EVENTO = [
  { cols: ", envio_previsto, retorno_previsto, distancia_ida_km, distancia_volta_km", falta: /envio_previsto|retorno_previsto|distancia_ida_km|distancia_volta_km/, semAte: 0 },
  { cols: ", contato_origem, contato_retorno, endereco_retorno, custos_extras", falta: /contato_origem|contato_retorno|endereco_retorno|custos_extras/, semAte: 0 },
];
const colunasEvento = () => (COLUNAS_EVENTO_BASE + GRUPOS_DO_EVENTO.filter((g) => Date.now() >= g.semAte).map((g) => g.cols).join("")) as "*";
/** Se o erro é de coluna que falta num grupo, desliga o grupo por 20 s e devolve true (vale tentar de novo). */
function desligaGrupoDoEvento(mensagem: string): boolean {
  const g = GRUPOS_DO_EVENTO.find((x) => Date.now() >= x.semAte && x.falta.test(mensagem));
  if (!g) return false; g.semAte = Date.now() + 20000; return true;
}
const COLUNAS_RESERVA_BASE = "id, evento_id, veiculo_id, reserva_inicio, reserva_fim, chegada, retirada, estado, comentarios, origem, endereco_chegada, status_individual";
/** `endereco_retorno` só existe depois da migration 0023: se o banco reclamar dele, passamos a ler sem a coluna (o resto do app segue). */
let semEnderecoRetornoAte = 0;   // idem: volta ao normal sozinha 20 s depois
const comEnderecoRetorno = () => Date.now() >= semEnderecoRetornoAte;
/** (o tipo "*" só silencia a leitura dos nomes de coluna em tempo de compilação: a lista é montada na hora) */
const colunasReserva = () => (COLUNAS_RESERVA_BASE + (comEnderecoRetorno() ? ", endereco_retorno, envio, retorno" : "")) as "*";
const COLUNAS_RESERVA_ANTIGAS = "id, evento_id, veiculo_id, reserva_inicio, reserva_fim, estado, comentarios, origem, endereco_chegada, status_individual";
const COLUNAS_LOCAL = "id, evento_id, rotulo, endereco, cidade, estado, posicao, tipo";
const COLUNAS_LOCAL_ANTIGAS = "id, evento_id, rotulo, endereco, cidade, estado, posicao";

export async function listarEventos(): Promise<Evento[]> {
  const { data, error } = await supabase.from("eventos").select(colunasEvento()).order("created_at", { ascending: false }).order("id", { ascending: true }).limit(2000);
  if (error && desligaGrupoDoEvento(error.message)) return listarEventos();
  if (error) throw traduzir(error);
  return (data ?? []) as Evento[];
}
export async function listarReservas(): Promise<Reserva[]> {
  const { data, error } = await supabase.from("evento_veiculos").select(colunasReserva()).not("reserva_inicio", "is", null).order("reserva_inicio", { ascending: true }).order("id", { ascending: true }).limit(10000);
  if (!error) return ((data ?? []) as Reserva[]).map(lerReserva);
  if (comEnderecoRetorno() && /endereco_retorno|envio|retorno/.test(error.message)) { semEnderecoRetornoAte = Date.now() + 20000; return listarReservas(); }
  // migration 0007 (chegada/retirada) ainda não aplicada: lê sem essas colunas, para Status de uso e Agenda seguirem funcionando
  if (/chegada|retirada/.test(error.message)) {
    const antigo = await supabase.from("evento_veiculos").select(COLUNAS_RESERVA_ANTIGAS).not("reserva_inicio", "is", null).order("reserva_inicio", { ascending: true }).order("id", { ascending: true }).limit(10000);
    if (antigo.error) throw traduzir(antigo.error);
    return ((antigo.data ?? []) as Omit<Reserva, "chegada" | "retirada">[]).map((r) => ({ ...r, chegada: null, retirada: null }));
  }
  throw traduzir(error);
}
/** Os carros que estão em eventos mas ainda sem data (a agenda e a linha do tempo não os enxergam). */
export async function listarReservasSemData(): Promise<ReservaDoEvento[]> {
  const { data, error } = await supabase.from("evento_veiculos").select(colunasReserva()).is("reserva_inicio", null).order("id", { ascending: true }).limit(10000);
  if (error && comEnderecoRetorno() && /endereco_retorno|envio|retorno/.test(error.message)) { semEnderecoRetornoAte = Date.now() + 20000; return listarReservasSemData(); }
  if (error) throw traduzir(error);
  return (data ?? []) as ReservaDoEvento[];
}
/** Põe carros no evento SEM data (as datas entram depois, no evento ou carro a carro). */
export async function reservarSemData(eventoId: string, veiculoIds: string[]): Promise<ReservaDoEvento[]> {
  if (veiculoIds.length === 0) return [];
  const { data, error } = await supabase.from("evento_veiculos").insert(veiculoIds.map((veiculo_id) => ({ evento_id: eventoId, veiculo_id, estado: "reservado" }))).select(colunasReserva());
  if (error) throw traduzir(error);
  return (data ?? []) as ReservaDoEvento[];
}
export async function criarEvento(e: EventoNovo): Promise<Evento> {
  const { data, error } = await supabase.from("eventos").insert({ ...e, nome: e.nome.trim() }).select(colunasEvento()).single();
  if (error) throw traduzir(error);
  return data as Evento;
}
/** O editor da tabela entrega texto ("1.234,56"): km e custos viram número antes de ir ao banco. */
function numerosDoEvento(patch: Partial<EventoNovo>): Partial<EventoNovo> {
  const out: Record<string, unknown> = { ...patch };
  for (const k of ["distancia_ida_km", "distancia_volta_km", "custos_extras"]) {
    const v = out[k]; if (typeof v !== "string") continue;
    const n = paraNumero(v); out[k] = n === null ? null : k === "custos_extras" ? n : Math.round(n);
  }
  return out as Partial<EventoNovo>;
}
export async function atualizarEvento(id: string, patch: Partial<EventoNovo>): Promise<Evento> {
  const { data, error } = await supabase.from("eventos").update(numerosDoEvento(patch)).eq("id", id).select(colunasEvento()).single();
  if (error) throw traduzir(error);
  return data as Evento;
}
export async function excluirEvento(id: string): Promise<void> {
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error?.code === "23503") throw new ErroEvento("Não consegui excluir: ainda há dados ligados a este evento que travam a exclusão (o contrato, por exemplo). Falta aplicar a migration 0027 no banco.");
  if (error) throw traduzir(error);
}
const SEM_COLUNAS_NOVAS = /chegada|retirada/;
/** Reserva em aberto: início sem fim no banco vira SEM_FIM no app (e o contrário ao gravar). */
const lerReserva = <R extends { reserva_inicio: string | null; reserva_fim: string | null }>(r: R): R => (r.reserva_inicio && r.reserva_fim === null ? { ...r, reserva_fim: SEM_FIM } : r);
const fimParaBanco = <P extends { reserva_fim?: string | null }>(p: P): P => (p.reserva_fim === SEM_FIM ? { ...p, reserva_fim: null } : p);
const comNulos = (r: Omit<Reserva, "chegada" | "retirada">): Reserva => ({ ...r, chegada: null, retirada: null });

/** Reserva vários carros de uma vez no mesmo período. Tudo ou nada. */
export async function reservarVeiculos(eventoId: string, veiculoIds: string[], inicio: string, fim: string, estado: EstadoReserva = "reservado", janela: { chegada?: string | null; retirada?: string | null } = {}): Promise<Reserva[]> {
  if (veiculoIds.length === 0) return [];
  const base = veiculoIds.map((veiculo_id) => ({ evento_id: eventoId, veiculo_id, reserva_inicio: inicio, reserva_fim: fim === SEM_FIM ? null : fim, estado }));
  const completo = base.map((l) => ({ ...l, ...(janela.chegada ? { chegada: janela.chegada } : {}), ...(janela.retirada ? { retirada: janela.retirada } : {}) }));
  const { data, error } = await supabase.from("evento_veiculos").insert(completo).select(colunasReserva());
  if (!error) return ((data ?? []) as Reserva[]).map(lerReserva);
  if (SEM_COLUNAS_NOVAS.test(error.message) && !janela.chegada && !janela.retirada) {   // migration 0007 ainda não aplicada
    const antigo = await supabase.from("evento_veiculos").insert(base).select(COLUNAS_RESERVA_ANTIGAS);
    if (antigo.error) throw traduzir(antigo.error);
    return ((antigo.data ?? []) as Omit<Reserva, "chegada" | "retirada">[]).map(comNulos);
  }
  throw SEM_COLUNAS_NOVAS.test(error.message) ? new ErroEvento("Chegada e retirada ainda não foram ativadas no banco (falta aplicar a migration 0007).") : traduzir(error);
}
export async function atualizarReserva(id: string, patch: Partial<Pick<Reserva, "reserva_inicio" | "reserva_fim" | "chegada" | "retirada" | "estado" | "comentarios" | "origem" | "endereco_chegada" | "endereco_retorno" | "envio" | "retorno" | "status_individual">>): Promise<Reserva> {
  const { data, error } = await supabase.from("evento_veiculos").update(fimParaBanco(patch)).eq("id", id).select(colunasReserva()).single();
  if (!error) return lerReserva(data as Reserva);
  if (SEM_COLUNAS_NOVAS.test(error.message) && !("chegada" in patch) && !("retirada" in patch)) {   // migration 0007 ainda não aplicada
    const antigo = await supabase.from("evento_veiculos").update(fimParaBanco(patch)).eq("id", id).select(COLUNAS_RESERVA_ANTIGAS).single();
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
  if (error) {
    // sem a migration 0022 a coluna "tipo" não existe: lê sem ela (tudo é local)
    const antigo = await supabase.from("evento_locais").select(COLUNAS_LOCAL_ANTIGAS).order("posicao", { ascending: true }).limit(10000);
    if (antigo.error) throw traduzir(error);
    return (antigo.data ?? []) as EventoLocal[];
  }
  return (data ?? []) as EventoLocal[];
}
export async function criarLocais(eventoId: string, locais: EventoLocalNovo[], primeiraPosicao = 0): Promise<EventoLocal[]> {
  const validos = locais.filter((l) => l.endereco.trim() !== "");
  if (validos.length === 0) return [];
  const linhas = validos.map((l, i) => ({ evento_id: eventoId, rotulo: l.rotulo?.trim() || null, endereco: l.endereco.trim(), ...(l.tipo === "origem" ? { tipo: "origem" } : {}), ...(() => { const c = cidadeEUf(l.endereco); return { cidade: l.cidade?.trim() || c.cidade, estado: l.estado ? l.estado.toUpperCase() : c.estado }; })(), posicao: primeiraPosicao + i }));
  const { data, error } = await supabase.from("evento_locais").insert(linhas).select(COLUNAS_LOCAL);
  if (error) throw traduzir(error);
  return (data ?? []) as EventoLocal[];
}
export async function atualizarLocal(id: string, patch: Partial<EventoLocalNovo>): Promise<EventoLocal> {
  // cidade e UF saem sozinhas da linha do endereço (a máscara traz as duas)
  const derivado = typeof patch.endereco === "string" ? (() => { const c = cidadeEUf(patch.endereco); return { cidade: c.cidade, estado: c.estado }; })() : {};
  const { data, error } = await supabase.from("evento_locais").update({ ...patch, ...derivado }).eq("id", id).select(COLUNAS_LOCAL).single();
  if (error) throw traduzir(error);
  return data as EventoLocal;
}
export async function removerLocal(id: string): Promise<void> {
  const { error } = await supabase.from("evento_locais").delete().eq("id", id);
  if (error) throw traduzir(error);
}

// ---------- modelos desejados do evento ----------
const COLUNAS_DESEJADO = "id, evento_id, modelo, versao, cor, my, blindado, reserva_id, nao_atendido, nota, posicao";
const COLUNAS_DESEJADO_ANTIGA = "id, evento_id, modelo, versao, cor, my, reserva_id, nao_atendido, nota, posicao";   // enquanto a migration da blindagem não rodou
const semBlindagem = (e: { message: string }) => /blindado/.test(e.message);
const limpo = (t: string | null | undefined) => { const x = (t ?? "").trim(); return x === "" ? null : x; };

export async function listarDesejados(): Promise<ModeloDesejado[]> {
  let { data, error } = (await supabase.from("evento_modelos_desejados").select(COLUNAS_DESEJADO).order("posicao", { ascending: true }).limit(10000)) as { data: unknown[] | null; error: { message: string } | null };
  if (error && semBlindagem(error)) ({ data, error } = (await supabase.from("evento_modelos_desejados").select(COLUNAS_DESEJADO_ANTIGA).order("posicao", { ascending: true }).limit(10000)) as { data: unknown[] | null; error: { message: string } | null });
  if (error) throw traduzir(error);
  return (data ?? []) as ModeloDesejado[];
}
/** Cria uma linha por carro pedido (`quantidade` carros iguais viram linhas iguais). */
export async function criarDesejados(eventoId: string, itens: (ModeloDesejadoNovo & { quantidade?: number })[], primeiraPosicao = 0): Promise<ModeloDesejado[]> {
  const linhas = itens.filter((i) => limpo(i.modelo)).flatMap((i) => Array.from({ length: Math.max(1, Math.min(50, i.quantidade ?? 1)) }, () => ({ modelo: i.modelo.trim(), cor: limpo(i.cor), my: limpo(i.my), blindado: i.blindado ?? null })))
    .map((l, k) => ({ ...l, evento_id: eventoId, posicao: primeiraPosicao + k }));
  if (linhas.length === 0) return [];
  let { data, error } = (await supabase.from("evento_modelos_desejados").insert(linhas).select(COLUNAS_DESEJADO)) as { data: unknown[] | null; error: { message: string } | null };
  if (error && semBlindagem(error)) ({ data, error } = (await supabase.from("evento_modelos_desejados").insert(linhas.map(({ blindado, ...resto }) => (void blindado, resto))).select(COLUNAS_DESEJADO_ANTIGA)) as { data: unknown[] | null; error: { message: string } | null });
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
