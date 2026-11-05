import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Wrench, X } from "@phosphor-icons/react";
import { Button, Card, Segmented, useToast } from "../../ds";
import { TelaDoMotor } from "../../components/motor/TelaDoMotor";
import { useEixoDoTempo } from "../../components/motor/useEixoDoTempo";
import type { OnEditar } from "../../components/motor/useEdicao";
import { atualizarReserva } from "../../lib/eventos/dados";
import { barraDoEvento, barrasDoVeiculo } from "../../lib/eventos/barras";
import { diferencas, reajustarReserva } from "../../lib/linhaDoTempo/arrasto";
import type { Barra, ModoDeArrasto } from "../../lib/linhaDoTempo/tipos";
import { hojeLocal } from "../../lib/motor/datas";
import { reservasPorVeiculo } from "../../lib/eventos/uso";
import type { Evento } from "../../lib/eventos/tipos";
import { atualizarCampos } from "../../lib/veiculos/dados";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { barrasDeManutencao, ehBarraDeManutencao } from "../../lib/manutencoes/barras";
import { NovaManutencao } from "../manutencoes/NovaManutencao";
import { AdicionarVeiculos } from "../eventos/AdicionarVeiculos";
import { NovoEvento } from "../eventos/NovoEvento";
import { useDadosDeEventos } from "../eventos/useDadosDeEventos";
import { camposDoVeiculo, type ContextoDeUso } from "../veiculos/Veiculos";
import "../veiculos/veiculos.css";

/** Os dois painéis têm a mesma largura à esquerda: é isso que faz os dias dos carros e dos eventos ficarem um embaixo do outro. */
const LARGURA_ESQUERDA = 260;

/**
 * Planejamento: veículos em cima, eventos embaixo, UMA linha do tempo (os dois rolam juntos). Escolher um evento destaca as
 * reservas dele nas barras dos carros e abre "Reservar carros" ali mesmo, com aviso de conflito.
 */
export function Planejamento() {
  const navigate = useNavigate();
  const toast = useToast();
  const eixo = useEixoDoTempo("dia");
  const d = useDadosDeEventos();
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [reservando, setReservando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [criandoManutencao, setCriandoManutencao] = useState(false);

  const nomes = useMemo(() => new Map((d.eventos ?? []).map((e) => [e.id, e.nome])), [d.eventos]);
  const nomeDoEvento = (id: string) => nomes.get(id) ?? "?";
  const ctxUso = useMemo<ContextoDeUso>(() => ({ reservas: reservasPorVeiculo(d.reservas), nomeDoEvento: (id) => nomes.get(id) ?? "?", carregado: d.eventos !== null, hoje: hojeLocal(), manutencoes: d.manutencoesDoCarro }), [d.reservas, nomes, d.eventos, d.manutencoesDoCarro]);
  const camposVeiculo = useMemo(() => camposDoVeiculo(ctxUso), [ctxUso]);
  const selecionado = d.eventos?.find((e) => e.id === selecionadoId) ?? null;
  const carrosDoSelecionado = selecionado ? d.reservas.filter((r) => r.evento_id === selecionado.id && r.estado !== "cancelado").length : 0;

  const editarVeiculo: OnEditar<Veiculo> = async (linha, campo, valor) => { await atualizarCampos(linha.id, { [campo.edicao!.coluna]: valor } as Partial<Veiculo>); toast("Salvo"); };
  const alterarReserva = async (_v: Veiculo, barra: Barra, modo: ModoDeArrasto, delta: number) => {
    if (ehBarraDeManutencao(barra)) { await d.moverManutencao(barra.id, modo, delta); return; }
    const r = d.reservas.find((x) => x.id === barra.id); if (!r) return;
    const dif = diferencas(r, reajustarReserva(r, modo, delta));
    if (Object.keys(dif).length === 0) return;
    const salva = await atualizarReserva(r.id, dif);
    d.setReservas((l) => l.map((x) => (x.id === r.id ? salva : x)));
  };

  return (
    <div className="ds-page ds-page--wide" data-testid="planejamento">
      <div className="ds-stack">
        <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div><h1 className="t-h1">Planejamento</h1><p className="t-body t-muted">Carros e eventos na mesma linha do tempo. Arraste as barras para mudar as datas.</p></div>
          <div className="ds-row" style={{ flexWrap: "wrap" }}>
            <button type="button" className="mt-btn" onClick={() => eixo.irParaHoje()} data-testid="tl-hoje">Hoje</button>
            <Segmented options={[{ value: "dia", label: "Dia" }, { value: "semana", label: "Semana" }]} value={eixo.escala} onChange={(e) => eixo.mudarEscala(e)} />
            <Button variant="secondary" icon={<Wrench size={20} />} onClick={() => setCriandoManutencao(true)} data-testid="nova-manutencao">Nova manutenção</Button>
            <Button icon={<Plus size={20} />} onClick={() => setCriando(true)} data-testid="novo-evento">Novo evento</Button>
          </div>
        </div>

        <section aria-label="Veículos" className="ds-stack" data-testid="pane-veiculos">
          <h2 className="t-h3">Veículos</h2>
          <TelaDoMotor<Veiculo> tela="planejamento-veiculos" titulo="Veículos" subtitulo="" compacta modoFixo="timeline" eixo={eixo}
            linhas={d.eventos ? d.veiculos : null} erro={d.erro} campos={camposVeiculo} idDe={(v) => v.id} onEditar={editarVeiculo} onAbrir={(v) => navigate(`/veiculos/${v.id}`)}
            linhaDoTempo={{ barrasDe: (v) => [...barrasDoVeiculo(ctxUso.reservas.get(v.id) ?? [], nomeDoEvento, selecionadoId), ...barrasDeManutencao(d.manutencoesDoCarro.get(v.id) ?? [], ctxUso.hoje)], onAlterarBarra: alterarReserva, onAbrirBarra: (_v, b) => (ehBarraDeManutencao(b) ? navigate(`/manutencoes/${b.id}`) : setSelecionadoId((b.dados as { eventoId: string }).eventoId)) }}
            rotuloDoTotal={(n) => `${n} veículo${n === 1 ? "" : "s"}`} placeholderDaBusca="Buscar carro…" alturaDaLinhaDoTempo="38dvh" larguraEsquerda={LARGURA_ESQUERDA}
            vazio={<p className="t-body t-muted">Nenhum veículo cadastrado ainda.</p>} />
        </section>

        <section aria-label="Eventos" className="ds-stack" data-testid="pane-eventos">
          <h2 className="t-h3">Eventos</h2>
          {selecionado && (
            <Card><div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }} data-testid="evento-selecionado">
              <span className="t-body"><b>{selecionado.nome}</b> · {carrosDoSelecionado} carro{carrosDoSelecionado === 1 ? "" : "s"} reservado{carrosDoSelecionado === 1 ? "" : "s"}. As reservas dele estão destacadas nos carros.</span>
              <span className="ds-row" style={{ flexWrap: "wrap" }}>
                <Button size="sm" onClick={() => setReservando(true)} data-testid="reservar-para-selecionado">Reservar carros</Button>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/eventos/${selecionado.id}`)}>Abrir evento</Button>
                <Button size="sm" variant="ghost" icon={<X size={16} />} onClick={() => setSelecionadoId(null)} aria-label="Limpar seleção">Limpar</Button>
              </span>
            </div></Card>
          )}
          <TelaDoMotor<Evento> tela="planejamento-eventos" titulo="Eventos" subtitulo="" compacta modoFixo="timeline" eixo={eixo}
            linhas={d.eventos} erro={d.erro} campos={d.campos} idDe={(e) => e.id} onEditar={d.editarEvento} onAbrir={(e) => navigate(`/eventos/${e.id}`)} selecionadoId={selecionadoId} aoSelecionar={(e) => setSelecionadoId((atual) => (atual === e.id ? null : e.id))}
            linhaDoTempo={{ barrasDe: (e) => barraDoEvento(e, d.ctx.reservasDoEvento.get(e.id) ?? []), onAlterarBarra: d.moverEvento as never, onAbrirBarra: (e) => setSelecionadoId(e.id) }}
            rotuloDoTotal={(n) => `${n} evento${n === 1 ? "" : "s"}`} placeholderDaBusca="Buscar evento…" alturaDaLinhaDoTempo="30dvh" larguraEsquerda={LARGURA_ESQUERDA}
            vazio={<p className="t-body t-muted">Nenhum evento ainda. Crie o primeiro em “Novo evento”.</p>} />
        </section>
      </div>

      {selecionado && <AdicionarVeiculos aberto={reservando} onFechar={() => setReservando(false)} evento={selecionado} veiculos={d.veiculos} reservas={d.reservas} eventos={d.eventos ?? []} manutencoes={d.manutencoes} onReservar={(ids, ini, fim, janela) => d.reservar(selecionado.id, ids, ini, fim, janela)} />}
      <NovaManutencao aberto={criandoManutencao} onFechar={() => setCriandoManutencao(false)} veiculos={d.veiculos} onCriar={d.criarDeManutencao} />
      <NovoEvento aberto={criando} onFechar={() => setCriando(false)} onCriar={d.criar} onCriado={(e) => { setSelecionadoId(e.id); setReservando(true); }} />
    </div>
  );
}
