import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../ds";
import type { OnEditar } from "../../components/motor/useEdicao";
import { atualizarEvento, atualizarLocal, atualizarReserva, atualizarReservas, criarEvento, criarLocais, excluirEvento, listarEventos, listarLocais, listarReservas, removerLocal, removerReserva, reservarVeiculos } from "../../lib/eventos/dados";
import { reajustarReserva } from "../../lib/linhaDoTempo/arrasto";
import type { Evento, EventoLocal, EventoLocalNovo, EventoNovo, Reserva } from "../../lib/eventos/tipos";
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
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarEventos(), listarReservas(), listarVeiculos()]).then(([e, r, v]) => { setEventos(e); setReservas(r); setVeiculos(v); }, (e: Error) => setErro(e.message));
    listarLocais().then(setLocais, () => setLocais([]));   // sem a migration 0007 a lista de locais fica vazia; o resto funciona
  }, []);

  const ctx = useMemo<ContextoDeEventos>(() => {
    const m = new Map<string, Reserva[]>();
    for (const r of reservas) { const l = m.get(r.evento_id); if (l) l.push(r); else m.set(r.evento_id, [r]); }
    const lm = new Map<string, EventoLocal[]>();
    for (const l of [...locais].sort((a, b) => a.posicao - b.posicao)) { const x = lm.get(l.evento_id); if (x) x.push(l); else lm.set(l.evento_id, [l]); }
    return { reservasDoEvento: m, locaisDoEvento: lm, veiculos: new Map(veiculos.map((v) => [v.id, v])), carregado: true };
  }, [reservas, veiculos, locais]);
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
    toast(`${novas.length} carro${novas.length === 1 ? "" : "s"} reservado${novas.length === 1 ? "" : "s"}`);
  };
  const remover = async (r: Reserva) => { await removerReserva(r.id); setReservas((l) => l.filter((x) => x.id !== r.id)); toast("Carro removido do evento"); };
  const excluir = async (e: Evento) => { await excluirEvento(e.id); setEventos((l) => (l ?? []).filter((x) => x.id !== e.id)); setReservas((l) => l.filter((x) => x.evento_id !== e.id)); setLocais((l) => l.filter((x) => x.evento_id !== e.id)); toast("Evento excluído"); };
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
  const criar = async (e: EventoNovo, novosLocais: EventoLocalNovo[]): Promise<Evento> => {
    const criado = await criarEvento(e);
    setEventos((l) => [criado, ...(l ?? [])]);
    try { const feitos = await criarLocais(criado.id, novosLocais); setLocais((l) => [...l, ...feitos]); } catch (x) { toast(`Evento criado, mas os locais não foram salvos: ${(x as Error).message}`); }
    return criado;
  };

  return { eventos, reservas, setReservas, locais, veiculos, erro, ctx, campos, editarEvento, editarReserva, reservar, remover, excluir, editarLocal, adicionarLocais, tirarLocal, moverEvento, criar };
}
