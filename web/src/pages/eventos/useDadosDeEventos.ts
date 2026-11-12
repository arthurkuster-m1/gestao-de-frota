import { useVersaoDosDados } from "../../lib/sincronia";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../ds";
import type { OnEditar } from "../../components/motor/useEdicao";
import { removerDesejado, listarReservasSemData, reservarSemData, atualizarEvento, atualizarLocal, atualizarReserva, atualizarReservas, criarEvento, criarLocais, excluirEvento, listarEventos, listarLocais, listarReservas, removerLocal, removerReserva, reservarVeiculos, atualizarAnotacao, atualizarDesejado, criarAnotacao, criarDesejados, listarAnotacoes, listarDesejados, removerAnotacao } from "../../lib/eventos/dados";
import { nomeAutomatico, nomeUnico } from "../../lib/eventos/nome";
import { useTiposDeEvento } from "../../lib/eventos/tiposDeEvento";
import { fatosDosEventos, statusAutomatico } from "../../lib/eventos/automacaoDeStatus";
import { hojeLocal } from "../../lib/motor/datas";
import { reservasSemChecklist } from "../../lib/checklists/regras";
import { atendimentoDosPedidos, pedidoQueAtende } from "../../lib/eventos/desejados";
import { reajustarReserva } from "../../lib/linhaDoTempo/arrasto";
import { useManutencoes } from "../manutencoes/useManutencoes";
import { useTransportes } from "../transportes/useTransportes";
import { useChecklists } from "../checklists/useChecklists";
import type { ReservaDoEvento, AnotacaoDoCarro, AnotacaoNova, Evento, EventoLocal, EventoLocalNovo, EventoNovo, ModeloDesejado, ModeloDesejadoNovo, Reserva } from "../../lib/eventos/tipos";
import { rotuloStatusEvento } from "../../lib/eventos/tipos";
import { listarClientes, type ClienteResumo } from "../../lib/clientes/dados";
import { listarVeiculos } from "../../lib/veiculos/dados";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { camposDoEvento, type ContextoDeEventos, type ReservaLinha } from "./camposDoEvento";

/** Status que a automação já tentou aplicar nesta sessão ("id:status"), compartilhado entre as telas abertas. */
const jaAutomatizados = new Set<string>();

/** Os dados de eventos, reservas, locais e veículos e todas as ações sobre eles. Usado pela tela Eventos e pelo Planejamento. */
export function useDadosDeEventos() {
  const toast = useToast();
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [locais, setLocais] = useState<EventoLocal[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [reservasSemData, setReservasSemData] = useState<ReservaDoEvento[]>([]);
  const [desejados, setDesejados] = useState<ModeloDesejado[]>([]);
  const [desejadosOk, setDesejadosOk] = useState(false);
  const [anotacoes, setAnotacoes] = useState<AnotacaoDoCarro[]>([]);
  const man = useManutencoes();
  const tr = useTransportes();
  const ck = useChecklists((id, estado) => setReservas((l) => l.map((r) => (r.id === id ? { ...r, estado } : r))), (id) => reservas.find((r) => r.id === id)?.estado);
  const [erro, setErro] = useState<string | null>(null);
  const [semDataOk, setSemDataOk] = useState(false);

  const versao = useVersaoDosDados();
  useEffect(() => {
    Promise.all([listarEventos(), listarReservas(), listarVeiculos()]).then(([e, r, v]) => { setEventos(e); setReservas(r); setVeiculos(v); }, (e: Error) => setErro(e.message));
    listarReservasSemData().then((l) => { setReservasSemData(l); setSemDataOk(true); }, () => { setReservasSemData([]); setSemDataOk(true); });
    listarClientes().then(setClientes, () => setClientes([]));
    listarDesejados().then((d) => { setDesejados(d); setDesejadosOk(true); }, () => setDesejados([]));
    listarAnotacoes().then(setAnotacoes, () => setAnotacoes([]));
    listarLocais().then(setLocais, () => setLocais([]));   // sem a migration 0007 a lista de locais fica vazia; o resto funciona
  }, [versao]);

  const tiposDeEvento = useTiposDeEvento();
  const semRetornoRef = useRef(tiposDeEvento.semRetorno); semRetornoRef.current = tiposDeEvento.semRetorno;
  // Automação do status do evento (regras em lib/eventos/automacaoDeStatus.ts). Roda quando os dados mudam e a cada virada de dia; só anda para a frente.
  const hoje = hojeLocal();
  useEffect(() => {
    if (eventos === null || !tr.carregado || !ck.carregado || !semDataOk) return;
    const fatos = fatosDosEventos({ reservas: [...reservas, ...reservasSemData], vinculos: tr.vinculos, transportes: tr.transportes, checklists: ck.checklists });
    for (const e of eventos) {
      const novo = statusAutomatico(e, fatos.get(e.id) ?? { carros: 0, comTransporteIda: 0, comTransporteVolta: 0, comChecklistSaida: 0, comChecklistRetorno: 0 }, hoje, { semRetorno: semRetornoRef.current(e.tipo) });
      const chave = `${e.id}:${novo}`;
      if (novo === e.status || jaAutomatizados.has(chave)) continue;
      jaAutomatizados.add(chave);   // uma tentativa por mudança (se o banco recusar, não fica tentando em loop)
      void atualizarEvento(e.id, { status: novo }).then((a) => { setEventos((l) => (l ?? []).map((x) => (x.id === a.id ? a : x))); toast(`${a.nome}: agora em “${rotuloStatusEvento(novo)}”`); }, () => undefined);
    }
  }, [eventos, reservas, reservasSemData, tr.carregado, tr.vinculos, tr.transportes, ck.carregado, ck.checklists, semDataOk, hoje, tiposDeEvento.tipos]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Todo carro reservado tem de estar ligado a um modelo solicitado: pedido que um carro já atende ganha o vínculo; carro sem pedido ganha um pedido novo.
  const curados = useRef(new Set<string>());
  useEffect(() => {
    if (!desejadosOk || !semDataOk || eventos === null || veiculos.length === 0) return;
    const todas = [...reservas, ...reservasSemData].filter((r) => r.estado !== "cancelado");
    const mapa = new Map(veiculos.map((v) => [v.id, v]));
    for (const e of eventos) {
      const ativas = todas.filter((r) => r.evento_id === e.id); if (ativas.length === 0) continue;
      const pedidos = desejados.filter((d) => d.evento_id === e.id);
      const atende = atendimentoDosPedidos(pedidos, ativas, mapa);
      const comPedido = new Set(atende.values());
      for (const [pid, vid] of atende) {
        const ped = pedidos.find((x) => x.id === pid), r = ativas.find((x) => x.veiculo_id === vid);
        if (!ped || ped.reserva_id || !r || curados.current.has(`l:${pid}`)) continue;
        curados.current.add(`l:${pid}`);
        void atualizarDesejado(pid, { reserva_id: r.id }).then((s) => setDesejados((l) => l.map((x) => (x.id === s.id ? s : x))), () => undefined);
      }
      for (const r of ativas) {
        const v = mapa.get(r.veiculo_id);
        if (!v || comPedido.has(r.veiculo_id) || curados.current.has(`c:${r.id}`)) continue;
        curados.current.add(`c:${r.id}`);   // uma tentativa por carro (evita criar pedidos em loop)
        void criarPedidoDoCarro(e.id, r.id, v);
      }
    }
  }, [desejadosOk, semDataOk, eventos, reservas, reservasSemData, desejados, veiculos]);   // eslint-disable-line react-hooks/exhaustive-deps

  const pedidosPorEvento = useMemo(() => { const m = new Map<string, ModeloDesejado[]>(); for (const p of desejados) { const l = m.get(p.evento_id); if (l) l.push(p); else m.set(p.evento_id, [p]); } return m; }, [desejados]);
  const ctx = useMemo<ContextoDeEventos>(() => {
    const m = new Map<string, Reserva[]>();
    for (const r of reservas) { const l = m.get(r.evento_id); if (l) l.push(r); else m.set(r.evento_id, [r]); }
    const lm = new Map<string, EventoLocal[]>();
    for (const l of locais.filter((x) => x.tipo !== "origem").sort((a, b) => a.posicao - b.posicao)) { const x = lm.get(l.evento_id); if (x) x.push(l); else lm.set(l.evento_id, [l]); }
    const sd = new Map<string, ReservaDoEvento[]>();
    for (const r of reservasSemData) { const l = sd.get(r.evento_id); if (l) l.push(r); else sd.set(r.evento_id, [r]); }
    return { semDataDoEvento: sd, clientes: new Map(clientes.map((c) => [c.id, c.nome])), reservasDoEvento: m, locaisDoEvento: lm, veiculos: new Map(veiculos.map((v) => [v.id, v])), carregado: true, valorDoEvento: tr.valorDoEvento, tiposDeEvento: tiposDeEvento.tipos, desejadosDoEvento: pedidosPorEvento };
  }, [reservas, reservasSemData, veiculos, locais, clientes, tr.valorDoEvento, tiposDeEvento.tipos, pedidosPorEvento]);
  const campos = useMemo(() => camposDoEvento(ctx), [ctx]);

  /** Evento colocado em uso à mão: se há carros sem checklist de envio, o app oferece fazer o de todos. */
  const [pendenciaDeChecklist, setPendenciaDeChecklist] = useState<string | null>(null);
  const editarEvento: OnEditar<Evento> = async (linha, campo, valor) => {
    // as datas do evento SÃO as das reservas dos carros: com carros reservados, mudam arrastando na linha do tempo ou na aba Veículos
    if ((campo.id === "inicio" || campo.id === "fim") && reservas.some((r) => r.evento_id === linha.id && r.estado !== "cancelado")) throw new Error("As datas seguem as reservas dos carros: ajuste na aba Veículos ou arraste a barra na linha do tempo.");
    const atualizado = await atualizarEvento(linha.id, { [campo.edicao!.coluna]: valor } as Partial<Evento>);
    setEventos((l) => (l ?? []).map((x) => (x.id === linha.id ? atualizado : x)));
    if (campo.id === "status" && valor === "em_uso") {
      const doEvento = [...reservas, ...reservasSemData].filter((r) => r.evento_id === linha.id);
      if (reservasSemChecklist(doEvento, ck.checklists, "saida").length > 0) setPendenciaDeChecklist(linha.id);
    }
  };
  const editarReserva: OnEditar<ReservaLinha> = async (linha, campo, valor) => {
    const atualizada = await atualizarReserva(linha.id, { [campo.edicao!.coluna]: valor } as Partial<Reserva>);
    setReservas((l) => l.map((x) => (x.id === linha.id ? atualizada : x)));
  };
  /** Grava campos da reserva (individualização por carro: origem, endereço de chegada, status, datas). */
  const salvarReserva = async (id: string, patch: Partial<Pick<Reserva, "chegada" | "retirada" | "origem" | "endereco_chegada" | "endereco_retorno" | "envio" | "retorno" | "status_individual" | "comentarios" | "reserva_inicio" | "reserva_fim">>) => {
    // carro sem data que ganha chegada E retirada passa a ter data (o período da reserva = chegada..retirada)
    const sem = reservasSemData.find((x) => x.id === id);
    let corpo = patch;
    if (sem && patch.reserva_inicio === undefined) {
      const c = patch.chegada ?? sem.chegada, t = patch.retirada ?? sem.retirada;
      if (c && t) corpo = { ...patch, reserva_inicio: c, reserva_fim: t };
    }
    const salva = await atualizarReserva(id, corpo) as ReservaDoEvento;
    const comData = !!(salva.reserva_inicio && salva.reserva_fim);
    setReservas((l) => (comData ? (l.some((x) => x.id === id) ? l.map((x) => (x.id === id ? (salva as Reserva) : x)) : [...l, salva as Reserva]) : l.filter((x) => x.id !== id)));
    setReservasSemData((l) => (comData ? l.filter((x) => x.id !== id) : (l.some((x) => x.id === id) ? l.map((x) => (x.id === id ? salva : x)) : [...l, salva])));
  };
  /** Carro reservado sem modelo solicitado: cria o modelo solicitado dele (modelo, cor, MY e blindagem do próprio carro) já ligado à reserva. */
  const criarPedidoDoCarro = async (eventoId: string, reservaId: string, v: Veiculo) => {
    try {
      const [novo] = await criarDesejados(eventoId, [{ modelo: v.modelo, cor: v.cor, my: v.my, blindado: v.blindado ?? null }], desejados.filter((d) => d.evento_id === eventoId).length);
      if (!novo) return;
      const salvo = await atualizarDesejado(novo.id, { reserva_id: reservaId });
      setDesejados((l) => [...l.filter((x) => x.id !== salvo.id), salvo]);
    } catch { /* o carro foi reservado; o vínculo é refeito na próxima abertura */ }
  };
  /** Liga cada carro novo ao pedido (modelo desejado) que ele atende; carro de outro modelo entra como substituição, sem pedido. */
  const ligarAosPedidos = async (eventoId: string, novas: { id: string; veiculo_id: string }[], pedidoId?: string) => {
    let abertos = desejados.filter((p) => p.evento_id === eventoId);
    for (const [i, r] of novas.entries()) {
      const v = veiculos.find((x) => x.id === r.veiculo_id);
      const alvo = i === 0 && pedidoId ? abertos.find((x) => x.id === pedidoId && !x.reserva_id) : undefined;   // veio da linha de um pedido: liga a ela
      const p = alvo ?? (v && pedidoQueAtende(v, abertos)); if (!p) { if (v) await criarPedidoDoCarro(eventoId, r.id, v); continue; }
      abertos = abertos.map((x) => (x.id === p.id ? { ...x, reserva_id: r.id } : x));
      try { const salvo = await atualizarDesejado(p.id, { reserva_id: r.id }); setDesejados((l) => l.map((x) => (x.id === salvo.id ? salvo : x))); } catch { /* o carro foi reservado; o vínculo com o pedido pode ser refeito */ }
    }
  };
  const reservar = async (eventoId: string, ids: string[], ini: string, fim: string, janela: { chegada: string; retirada: string }, pedidoId?: string) => {
    const novas = await reservarVeiculos(eventoId, ids, ini, fim, "reservado", janela);
    setReservas((l) => [...l, ...novas]);
    await ligarAosPedidos(eventoId, novas, pedidoId);
    toast(`${novas.length} carro${novas.length === 1 ? "" : "s"} reservado${novas.length === 1 ? "" : "s"}`);
  };
  /** Põe carros no evento sem data (as datas entram depois). */
  const reservarSemDatas = async (eventoId: string, ids: string[], pedidoId?: string) => {
    const novas = await reservarSemData(eventoId, ids);
    setReservasSemData((l) => [...l, ...novas]);
    await ligarAosPedidos(eventoId, novas, pedidoId);
    toast(`${novas.length} carro${novas.length === 1 ? "" : "s"} no evento, sem data`);
  };
  const remover = async (r: { id: string }) => { await removerReserva(r.id); setReservas((l) => l.filter((x) => x.id !== r.id)); setReservasSemData((l) => l.filter((x) => x.id !== r.id)); setDesejados((l) => l.map((x) => (x.reserva_id === r.id ? { ...x, reserva_id: null } : x))); toast("Carro removido do evento"); };
  const excluir = async (e: Evento) => { await excluirEvento(e.id); setEventos((l) => (l ?? []).filter((x) => x.id !== e.id)); setDesejados((l) => l.filter((x) => x.evento_id !== e.id)); setReservas((l) => l.filter((x) => x.evento_id !== e.id)); setReservasSemData((l) => l.filter((x) => x.evento_id !== e.id)); setLocais((l) => l.filter((x) => x.evento_id !== e.id)); toast("Evento excluído"); };
  const editarLocal: OnEditar<EventoLocal> = async (linha, campo, valor) => {
    const novo = await atualizarLocal(linha.id, { [campo.edicao!.coluna]: valor } as Partial<EventoLocalNovo>);
    setLocais((l) => l.map((x) => (x.id === linha.id ? novo : x)));
  };
  const adicionarLocais = async (eventoId: string, novos: EventoLocalNovo[]) => {
    const tipoNovo = novos[0]?.tipo ?? "local";
    const criados = await criarLocais(eventoId, novos, locais.filter((l) => l.evento_id === eventoId && (l.tipo ?? "local") === tipoNovo).length);
    setLocais((l) => [...l, ...criados]); toast(tipoNovo === "origem" ? "Origem adicionada" : "Local adicionado");
  };
  const tirarLocal = async (l: EventoLocal) => { await removerLocal(l.id); setLocais((x) => x.filter((y) => y.id !== l.id)); toast("Local removido"); };
  /** Arrastar a barra de um evento move TODAS as reservas dele (chegada e retirada acompanham). */
  const moverEvento = async (e: Evento, _b: unknown, modo: "mover" | "inicio" | "fim", delta: number) => {
    if (modo !== "mover") return;
    const doEvento = reservas.filter((r) => r.evento_id === e.id && r.estado !== "cancelado");
    const salvas = await atualizarReservas(doEvento.map((r) => r.id), (id) => { const r = doEvento.find((x) => x.id === id)!; const n = reajustarReserva(r, "mover", delta); return { reserva_inicio: n.reserva_inicio, reserva_fim: n.reserva_fim, ...(r.chegada ? { chegada: n.chegada } : {}), ...(r.retirada ? { retirada: n.retirada } : {}) }; });
    setReservas((l) => l.map((x) => salvas.find((s) => s.id === x.id) ?? x));
  };
  /** Cria o evento e os locais digitados. Se os locais falharem, o evento fica (e o aviso diz o que faltou). */
  const criar = async (e: EventoNovo, novosLocais: EventoLocalNovo[], pedidos: (ModeloDesejadoNovo & { quantidade?: number })[] = []): Promise<Evento> => {
    const nome = e.nome.trim() ? e.nome : nomeUnico(nomeAutomatico(e.chegada_prevista, e.solicitante), (eventos ?? []).map((x) => x.nome));   // cadastro rápido
    const criado = await criarEvento({ ...e, nome });
    setEventos((l) => [criado, ...(l ?? [])]);
    try { const feitos = await criarLocais(criado.id, novosLocais); setLocais((l) => [...l, ...feitos]); } catch (x) { toast(`Evento criado, mas os locais não foram salvos: ${(x as Error).message}`); }
    if (pedidos.length) { try { const feitos = await criarDesejados(criado.id, pedidos); setDesejados((l) => [...l, ...feitos]); } catch (x) { toast(`Evento criado, mas os modelos desejados não foram salvos: ${(x as Error).message}`); } }
    return criado;
  };
  const adicionarDesejados = async (eventoId: string, pedidos: (ModeloDesejadoNovo & { quantidade?: number })[]) => {
    const feitos = await criarDesejados(eventoId, pedidos, desejados.filter((d) => d.evento_id === eventoId).length);
    setDesejados((l) => [...l, ...feitos]); toast(`${feitos.length} carro${feitos.length === 1 ? "" : "s"} pedido${feitos.length === 1 ? "" : "s"}`);
  };
  /** Anotação livre de um modelo solicitado (o que está rolando com aquele pedido). */
  const salvarNotaDoPedido = async (id: string, nota: string | null) => { const s = await atualizarDesejado(id, { nota }); setDesejados((l) => l.map((x) => (x.id === s.id ? s : x))); };
  /** Tira um modelo do pedido do evento (a solicitação mudou). A reserva do carro que o atendia continua. */
  const removerPedido = async (id: string) => { await removerDesejado(id); setDesejados((l) => l.filter((x) => x.id !== id)); toast("Modelo solicitado excluído"); };
  /** "Veículo não estava disponível": fica registrado que o pedido não foi atendido (desfazer = false). */
  const marcarNaoAtendido = async (id: string, naoAtendido: boolean) => {
    const salvo = await atualizarDesejado(id, { nao_atendido: naoAtendido }); setDesejados((l) => l.map((x) => (x.id === id ? salvo : x)));
  };
  const criarNota = async (a: AnotacaoNova) => { const n = await criarAnotacao(a); setAnotacoes((l) => [...l, n]); toast("Anotação criada"); return n; };
  const editarNota = async (id: string, patch: Partial<Pick<AnotacaoDoCarro, "titulo" | "inicio" | "fim" | "comentarios">>) => { const n = await atualizarAnotacao(id, patch); setAnotacoes((l) => l.map((x) => (x.id === id ? n : x))); };
  const moverNota = (id: string, inicio: string, fim: string) => editarNota(id, { inicio, fim });
  const excluirNota = async (id: string) => { await removerAnotacao(id); setAnotacoes((l) => l.filter((x) => x.id !== id)); toast("Anotação removida"); };

  const locaisSemOrigens = useMemo(() => locais.filter((l) => l.tipo !== "origem"), [locais]);
  const origensExtras = useMemo(() => locais.filter((l) => l.tipo === "origem"), [locais]);
  return { salvarNotaDoPedido, tiposDeEvento: tiposDeEvento.tipos, semRetornoDoTipo: tiposDeEvento.semRetorno, removerPedido, pendenciaDeChecklist, fecharPendenciaDeChecklist: () => setPendenciaDeChecklist(null), ck, tr, manutencoes: man.manutencoes, manutencoesDoCarro: man.doCarro, editarManutencao: man.editar, criarDeManutencao: man.criar, excluirDeManutencao: man.excluir, moverManutencao: man.mover, eventos, reservas, setReservas, reservasSemData, reservarSemDatas, locais: locaisSemOrigens, origensExtras, veiculos, clientes, desejados, anotacoes, adicionarDesejados, marcarNaoAtendido, criarNota, editarNota, moverNota, excluirNota, erro, ctx, campos, editarEvento, editarReserva, salvarReserva, reservar, remover, excluir, editarLocal, adicionarLocais, tirarLocal, moverEvento, criar };
}
