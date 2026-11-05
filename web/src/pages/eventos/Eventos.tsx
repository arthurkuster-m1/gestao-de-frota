import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarCheck, Plus } from "@phosphor-icons/react";
import { Button, Card, EmptyState, Field, Input, Select, Sheet, useToast } from "../../ds";
import { TelaDoMotor } from "../../components/motor/TelaDoMotor";
import type { OnEditar } from "../../components/motor/useEdicao";
import { atualizarEvento, atualizarReserva, criarEvento, excluirEvento, listarEventos, listarReservas, removerReserva, reservarVeiculos } from "../../lib/eventos/dados";
import { TIPOS_EVENTO, type Evento, type Reserva } from "../../lib/eventos/tipos";
import { listarVeiculos } from "../../lib/veiculos/dados";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { camposDoEvento, type ContextoDeEventos, type ReservaLinha } from "./camposDoEvento";
import { JanelaDoEvento } from "./JanelaDoEvento";

export function Eventos() {
  const navigate = useNavigate();
  const toast = useToast();
  const { id: idAberto } = useParams<{ id?: string }>();
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [aba, setAba] = useState<"dados" | "veiculos" | "comentarios">("dados");
  const [novo, setNovo] = useState({ nome: "", tipo: "", solicitante: "" });
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([listarEventos(), listarReservas(), listarVeiculos()]).then(([e, r, v]) => { setEventos(e); setReservas(r); setVeiculos(v); }, (e: Error) => setErro(e.message));
  }, []);

  const ctx = useMemo<ContextoDeEventos>(() => {
    const m = new Map<string, Reserva[]>();
    for (const r of reservas) { const l = m.get(r.evento_id); if (l) l.push(r); else m.set(r.evento_id, [r]); }
    return { reservasDoEvento: m, veiculos: new Map(veiculos.map((v) => [v.id, v])), carregado: true };
  }, [reservas, veiculos]);
  const campos = useMemo(() => camposDoEvento(ctx), [ctx]);

  const editarEvento: OnEditar<Evento> = async (linha, campo, valor) => {
    const atualizado = await atualizarEvento(linha.id, { [campo.edicao!.coluna]: valor } as Partial<Evento>);
    setEventos((l) => (l ?? []).map((x) => (x.id === linha.id ? atualizado : x)));
  };
  const editarReserva: OnEditar<ReservaLinha> = async (linha, campo, valor) => {
    const atualizada = await atualizarReserva(linha.id, { [campo.edicao!.coluna]: valor } as Partial<Reserva>);
    setReservas((l) => l.map((x) => (x.id === linha.id ? atualizada : x)));
  };
  const reservar = async (eventoId: string, ids: string[], ini: string, fim: string) => {
    const novas = await reservarVeiculos(eventoId, ids, ini, fim);
    setReservas((l) => [...l, ...novas]);
    toast(`${novas.length} carro${novas.length === 1 ? "" : "s"} reservado${novas.length === 1 ? "" : "s"}`);
  };
  const remover = async (r: Reserva) => { await removerReserva(r.id); setReservas((l) => l.filter((x) => x.id !== r.id)); toast("Carro removido do evento"); };
  const excluir = async (e: Evento) => { await excluirEvento(e.id); setEventos((l) => (l ?? []).filter((x) => x.id !== e.id)); setReservas((l) => l.filter((x) => x.evento_id !== e.id)); navigate("/eventos"); toast("Evento excluído"); };

  async function criar() {
    setFalha(null); setEnviando(true);
    try {
      const e = await criarEvento({ nome: novo.nome, tipo: novo.tipo || null, solicitante: novo.solicitante.trim() || null });
      setEventos((l) => [e, ...(l ?? [])]); setCriando(false); setNovo({ nome: "", tipo: "", solicitante: "" });
      setAba("veiculos"); navigate(`/eventos/${e.id}`);
    } catch (x) { setFalha((x as Error).message); } finally { setEnviando(false); }
  }

  const aberto = idAberto && eventos ? (eventos.find((x) => x.id === idAberto) ?? null) : null;
  useEffect(() => { if (idAberto && eventos && !eventos.some((x) => x.id === idAberto)) navigate("/eventos", { replace: true }); }, [idAberto, eventos, navigate]);
  useEffect(() => { if (!idAberto) setAba("dados"); }, [idAberto]);

  return (
    <>
      <TelaDoMotor<Evento> tela="eventos" titulo="Eventos" subtitulo="Solicitações de uso, com os carros reservados em cada uma."
        acoes={<Button icon={<Plus size={20} />} onClick={() => { setFalha(null); setCriando(true); }} data-testid="novo-evento">Novo evento</Button>}
        linhas={eventos} erro={erro} campos={campos} idDe={(x) => x.id} onEditar={editarEvento} onAbrir={(x) => navigate(`/eventos/${x.id}`)}
        rotuloDoTotal={(n) => `${n} evento${n === 1 ? "" : "s"}`} placeholderDaBusca="Buscar evento, tipo, solicitante…"
        vazio={<EmptyState icon={<CalendarCheck size={30} />} title="Nenhum evento ainda" action={<Button icon={<Plus size={20} />} onClick={() => setCriando(true)}>Criar o primeiro</Button>}>Crie o evento e depois escolha os carros. O Status de uso e a Agenda de cada carro se atualizam sozinhos.</EmptyState>}
        filhos={<JanelaDoEvento evento={aberto} campos={campos} abaInicial={aba} veiculos={veiculos} reservas={reservas} eventos={eventos ?? []} onEditarEvento={editarEvento} onEditarReserva={editarReserva} onReservar={reservar} onRemoverReserva={remover} onExcluir={excluir} onFechar={() => navigate("/eventos")} />} />
      <Sheet open={criando} onClose={() => setCriando(false)} title="Novo evento">
        <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
          <Field label="Nome do evento" error={falha}><Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Ex.: Convenção Tesouraria" maxLength={120} autoFocus /></Field>
          <Field label="Tipo"><Select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })} placeholder="Escolher…"><option value="">Sem tipo</option>{TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
          <Field label="Solicitante"><Input value={novo.solicitante} onChange={(e) => setNovo({ ...novo, solicitante: e.target.value })} /></Field>
          <p className="t-body-sm t-muted">Depois de criar, você escolhe os carros e o período.</p>
          <Button type="submit" size="lg" block disabled={!novo.nome.trim()} loading={enviando} data-testid="criar-evento">Criar evento</Button>
        </form>
      </Sheet>
    </>
  );
}
