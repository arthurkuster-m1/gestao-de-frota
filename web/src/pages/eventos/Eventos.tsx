import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarCheck, Plus } from "@phosphor-icons/react";
import { Button, EmptyState } from "../../ds";
import { TelaDoMotor } from "../../components/motor/TelaDoMotor";
import { barraDoEvento } from "../../lib/eventos/barras";
import type { Evento } from "../../lib/eventos/tipos";
import { SubpaginasDeEventos } from "./SubpaginasDeEventos";
import { NovoEvento } from "./NovoEvento";
import { PaginaDoEvento } from "./PaginaDoEvento";
import { useDadosDeEventos } from "./useDadosDeEventos";

/** A lista de eventos; abrir um evento leva à página inteira dele (Dados, Veículos, Transportes, Contratos). */
export function Eventos() {
  const navigate = useNavigate();
  const { id: idAberto } = useParams<{ id?: string }>();
  const d = useDadosDeEventos();
  const [criando, setCriando] = useState(false);

  const aberto = idAberto && d.eventos ? (d.eventos.find((x) => x.id === idAberto) ?? null) : null;
  useEffect(() => { if (idAberto && d.eventos && !d.eventos.some((x) => x.id === idAberto)) navigate("/eventos", { replace: true }); }, [idAberto, d.eventos, navigate]);

  if (aberto) {
    return (
      <PaginaDoEvento evento={aberto} campos={d.campos} veiculos={d.veiculos} reservas={d.reservas} eventos={d.eventos ?? []} locais={d.locais} desejados={d.desejados} manutencoes={d.manutencoes} tr={d.tr}
        checklists={d.ck.checklists} onSalvarChecklist={d.ck.salvar} onEditarLocal={d.editarLocal} onAdicionarLocais={d.adicionarLocais} onRemoverLocal={d.tirarLocal} onEditarEvento={d.editarEvento}
        onSalvarReserva={d.salvarReserva} onReservar={d.reservar} onRemoverReserva={d.remover} onNaoAtendido={d.marcarNaoAtendido} onAdicionarDesejados={d.adicionarDesejados}
        onExcluir={async (e) => { await d.excluir(e); navigate("/eventos"); }} />
    );
  }
  return (
    <>
      <TelaDoMotor<Evento> tela="eventos" titulo="Eventos" subtitulo="Solicitações de uso, com os carros reservados em cada uma." cabecalhoDireita={<SubpaginasDeEventos ativa="eventos" />}
        acoes={<Button icon={<Plus size={20} />} onClick={() => setCriando(true)} data-testid="novo-evento">Novo evento</Button>}
        linhas={d.eventos} erro={d.erro} campos={d.campos} idDe={(x) => x.id} onEditar={d.editarEvento} onAbrir={(x) => navigate(`/eventos/${x.id}`)}
        linhaDoTempo={{ barrasDe: (e) => barraDoEvento(e, d.ctx.reservasDoEvento.get(e.id) ?? []), onAlterarBarra: d.moverEvento as never, onAbrirBarra: (e) => navigate(`/eventos/${e.id}`) }}
        rotuloDoTotal={(n) => `${n} evento${n === 1 ? "" : "s"}`} placeholderDaBusca="Buscar evento, tipo, solicitante…"
        vazio={<EmptyState icon={<CalendarCheck size={30} />} title="Nenhum evento ainda" action={<Button icon={<Plus size={20} />} onClick={() => setCriando(true)}>Criar o primeiro</Button>}>Crie o evento e depois escolha os carros. O Status de uso e a Agenda de cada carro se atualizam sozinhos.</EmptyState>} />
      <NovoEvento aberto={criando} onFechar={() => setCriando(false)} onCriar={d.criar} onCriado={(e) => navigate(`/eventos/${e.id}?aba=veiculos`)} />
    </>
  );
}
