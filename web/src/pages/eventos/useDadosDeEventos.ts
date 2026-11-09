import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../ds";
import type { OnEditar } from "../../components/motor/useEdicao";
import { atualizarEvento, atualizarLocal, atualizarReserva, atualizarReservas, criarEvento, criarLocais, excluirEvento, listarEventos, listarLocais, listarReservas, removerLocal, removerReserva, reservarVeiculos, atualizarAnotacao, atualizarDesejado, criarAnotacao, criarDesejados, listarAnotacoes, listarDesejados, removerAnotacao } from "../../lib/eventos/dados";
import { nomeAutomatico, nomeUnico } from "../../lib/eventos/nome";
import { pedidoQueAtende } from "../../lib/eventos/desejados";
import { reajustarReserva } from "../../lib/linhaDoTempo/arrasto";
import { useManutencoes } from "../manutencoes/useManutencoes";
import { useTransportes } from "../transportes/useTransportes";
import { useChecklists } from "../checklists/useChecklists";
import type { AnotacaoDoCarro, AnotacaoNova, Evento, EventoLocal, EventoLocalNovo, EventoNovo, ModeloDesejado, ModeloDesejadoNovo, Reserva } from "../../lib/eventos/tipos";
import { listarVeiculos } from "../../lib/veiculos/dados";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { camposDoEvento, type ContextoDeEventos, type ReservaLinha } from "./camposDoEvento";

/** Os dados de eventos, reservas, locais e veículos e todas as ações sobre eles. Usado pela tela Eventos e pelo Planejamento. */
export function useDadosDeEventos() {
  const toast = useToast();
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [locais, setLocais] = useState<EventoLocal[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [desejados, setDesejados] = useState<ModeloDesejado[]>([]);
  const [anotacoes, setAnotacoes] = useState<AnotacaoDoCarro[]>([]);
  const man = useManutencoes();
  const tr = useTransportes();
  const ck = useChecklists((id, estado) => setReservas((l) => l.map((r) => (r.id === id ? { ...r, estado } : r))), (id) => reservas.find((r) => r.id === id)?.estado);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarEventos(), listarReservas(), listarVeiculos()]).then(([e, r, v]) => { setEventos(e); setReservas(r); setVeiculos(v); }, (e: Error) => setErro(e.message));
    listarDesejados().then(setDesejados, () => setDesejados([]));
    listarAnotacoes().then(setAnotacoes, () => setAnotacoes([]));
    listarLocais().then(setLocais, () => setLocais([]));   // sem a migration 0007 a lista de locais fica vazia; o resto funciona
  }, []);

  const ctx = useMemo<ContextoDeEventos>(() => {
    const m = new Map<string, Reserva[]>();
    for (const r of reservas) { const l = m.get(r.evento_id); if (l) l.push(r); else m.set(r.evento_id, [r]); }
    const lm = new Map<string, EventoLocal[]>();
    for (const l of [...locais].sort((a, b) => a.posicao - b.posicao)) { const x = lm.get(l.evento_id); if (x) x.push(l); else lm.set(l.evento_id, [l]); }
    return { reservasDoEvento: m, locaisDoEvento: lm, veiculos: new Map(veiculos.map((v) => [v.id, v])), carregado: true, valorDoEvento: tr.valorDoEvento };
  }, [reservas, veiculos, locais, tr.valorDoEvento]);
  const campos = useMemo(() => camposDoEvento(ctx), [ctx]);

  const editarEvento: OnEditar<Evento> = async (linha, campo, valor) => {
    const atualizado = await atualizarEvento(linha.id, { [campo.edicao!.coluna]: valor } as Partial<Evento>);
    setEventos((l) => (l ?? []).map((x) => (x.id === linha.id ? atualizado : x)));
  };
  const editarReserva: OnEditar<ReservaLinha> = async (linha, campo, valor) => {
    const atualizada = await atualizarReserva(linha.id, { [campo.edicao!.coluna]: valor } as Partial<Reserva>);
    setReservas((l) => l.map((x) => (x.id === linha.id ? atualizada : x)));
  };
  const reservar = async (eventoId: string, ids: string[], ini: string, fim: string, janela: { chegada: string; retirada: string }) => {
    const novas = await reservarVeiculos(eventoId, ids, ini, fim, "reservado", janela);
    setReservas((l) => [...l, ...novas]);
    // liga cada carro ao pedido (modelo desejado) que ele atende; carro de outro modelo entra como substituição, sem pedido
    let abertos = desejados.filter((p) => p.evento_id === eventoId);
    for (const r of novas) {
      const v = veiculos.find((x) => x.id === r.veiculo_id); const p = v && pedidoQueAtende(v, abertos); if (!p) continue;
      abertos = abertos.map((x) => (x.id === p.id ? { ...x, reserva_id: r.id } : x));
      try { const salvo = await atualizarDesejado(p.id, { reserva_id: r.id }); setDesejados((l) => l.map((x) => (x.id === salvo.id ? salvo : x))); } catch { /* o carro foi reservado; o vínculo com o pedido pode ser refeito */ }
    }
    toast(`${novas.length} carro${novas.length === 1 ? "" : "s"} reservado${novas.length === 1 ? "" : "s"}`);
  };
  const remover = async (r: Reserva) => { await removerReserva(r.id); setReservas((l) => l.filter((x) => x.id !== r.id)); setDesejados((l) => l.map((x) => (x.reserva_id === r.id ? { ...x, reserva_id: null } : x))); toast("Carro removido do evento"); };
  const excluir = async (e: Evento) => { await excluirEvento(e.id); setEventos((l) => (l ?? []).filter((x) => x.id !== e.id)); setDesejados((l) => l.filter((x) => x.evento_id !== e.id)); setReservas((l) => l.filter((x) => x.evento_id !== e.id)); setLocais((l) => l.filter((x) => x.evento_id !== e.id)); toast("Evento excluído"); };
  const editarLocal: OnEditar<EventoLocal> = async (linha, campo, valor) => {
    const novo = await atualizarLocal(linha.id, { [campo.edicao!.coluna]: valor } as Partial<EventoLocalNovo>);
    setLocais((l) => l.map((x) => (x.id === linha.id ? novo : x)));
  };
  const adicionarLocais = async (eventoId: string, novos: EventoLocalNovo[]) => {
    const criados = await criarLocais(eventoId, novos, locais.filter((l) => l.evento_id === eventoId).length);
    setLocais((l) => [...l, ...criados]); toast(`${criados.length} local${criados.length === 1 ? "" : "is"} adicionado${criados.length === 1 ? "" : "s"}`);
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
  /** "Veículo não estava disponível": fica registrado que o pedido não foi atendido (desfazer = false). */
  const marcarNaoAtendido = async (id: string, naoAtendido: boolean) => {
    const salvo = await atualizarDesejado(id, { nao_atendido: naoAtendido }); setDesejados((l) => l.map((x) => (x.id === id ? salvo : x)));
  };
  const criarNota = async (a: AnotacaoNova) => { const n = await criarAnotacao(a); setAnotacoes((l) => [...l, n]); toast("Anotação criada"); return n; };
  const editarNota = async (id: string, patch: Partial<Pick<AnotacaoDoCarro, "titulo" | "inicio" | "fim" | "comentarios">>) => { const n = await atualizarAnotacao(id, patch); setAnotacoes((l) => l.map((x) => (x.id === id ? n : x))); };
  const moverNota = (id: string, inicio: string, fim: string) => editarNota(id, { inicio, fim });
  const excluirNota = async (id: string) => { await removerAnotacao(id); setAnotacoes((l) => l.filter((x) => x.id !== id)); toast("Anotação removida"); };

  return { ck, tr, manutencoes: man.manutencoes, manutencoesDoCarro: man.doCarro, editarManutencao: man.editar, criarDeManutencao: man.criar, excluirDeManutencao: man.excluir, moverManutencao: man.mover, eventos, reservas, setReservas, locais, veiculos, desejados, anotacoes, adicionarDesejados, marcarNaoAtendido, criarNota, editarNota, moverNota, excluirNota, erro, ctx, campos, editarEvento, editarReserva, reservar, remover, excluir, editarLocal, adicionarLocais, tirarLocal, moverEvento, criar };
}
