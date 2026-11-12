import { useAbrirNoLugar } from "../../app/noLugar";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarPlus, NotePencil, Wrench, X } from "@phosphor-icons/react";
import { Button, Card, DateField, Segmented, Select, Sheet, useToast } from "../../ds";
import { BotoesDeCopia } from "../veiculos/BotoesDeCopia";
import { PainelFinanceiro } from "./PainelFinanceiro";
import { formatarDiaBr } from "../../lib/motor/datas";
import { TelaDoMotor } from "../../components/motor/TelaDoMotor";
import { useEixoDoTempo } from "../../components/motor/useEixoDoTempo";
import type { OnEditar } from "../../components/motor/useEdicao";
import { atualizarReserva } from "../../lib/eventos/dados";
import { cabeNosPedidos } from "../../lib/eventos/desejados";
import { anotacoesPorVeiculo, barrasDeAnotacao, ehBarraDeAnotacao } from "../../lib/veiculos/anotacoes";
import { aplicarArrasto } from "../../lib/linhaDoTempo/arrasto";
import { disponivelAPartirDe } from "../../lib/veiculos/previsoes";
import { conflitos, reservavelPeloCiclo } from "../../lib/eventos/uso";
import { manutencoesPorVeiculo, manutencoesQueBloqueiam } from "../../lib/manutencoes/regras";
import { PedidosDoEvento } from "../eventos/PedidosDoEvento";
import { AvisoDeChecklistEmMassa } from "../checklists/AvisoDeChecklistEmMassa";
import { useCriacaoNaLinha } from "./useCriacaoNaLinha";
import { AcoesDosVeiculosSelecionados } from "../veiculos/AcoesDosVeiculosSelecionados";
import type { AnotacaoDoCarro } from "../../lib/eventos/tipos";
import { barraDoEvento, barrasDoVeiculo } from "../../lib/eventos/barras";
import { diferencas, reajustarReserva } from "../../lib/linhaDoTempo/arrasto";
import type { Barra, ModoDeArrasto } from "../../lib/linhaDoTempo/tipos";
import { hojeLocal, somarDias } from "../../lib/motor/datas";
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
  const [params] = useSearchParams();
  /** /planejamento?veiculos=a,b ou ?eventos=a,b: abre o Planejamento já filtrado pela seleção ("Visualizar no Planejamento"). */
  const idsDaUrl = (chave: string) => (params.get(chave) ?? "").split(",").filter(Boolean);
  const abrirNoLugar = useAbrirNoLugar();
  const toast = useToast();
  const eixo = useEixoDoTempo("dia");
  const d = useDadosDeEventos();
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [reservando, setReservando] = useState(false);
  const [criando, setCriando] = useState(false);
  /** Objetivo do planejamento: visão geral, ou planejar UM evento (a tela se volta só para ele). */
  const [objetivo, setObjetivo] = useState<"geral" | "evento" | "disponiveis" | "financeiro">("geral");
  /** Objetivo "Veículos disponíveis": o intervalo escolhido (um dia só, se "Até" ficar igual a "De"). */
  const [de, setDe] = useState(() => hojeLocal());
  const [ate, setAte] = useState(() => hojeLocal());
  const periodoDisp = useMemo(() => ({ inicio: de, fim: ate && ate >= de ? ate : de }), [de, ate]);
  const criacao = useCriacaoNaLinha(d, (e) => { setObjetivo('evento'); setSelecionadoId(e.id); });

  const nomes = useMemo(() => new Map((d.eventos ?? []).map((e) => [e.id, e.nome])), [d.eventos]);
  const nomeDoEvento = (id: string) => nomes.get(id) ?? "?";
  const ctxUso = useMemo<ContextoDeUso>(() => ({ reservas: reservasPorVeiculo(d.reservas), nomeDoEvento: (id) => nomes.get(id) ?? "?", carregado: d.eventos !== null, hoje: hojeLocal(), manutencoes: d.manutencoesDoCarro }), [d.reservas, nomes, d.eventos, d.manutencoesDoCarro]);
  const camposVeiculo = useMemo(() => camposDoVeiculo(ctxUso), [ctxUso]);
  const selecionado = d.eventos?.find((e) => e.id === selecionadoId) ?? null;
  const carrosDoSelecionado = selecionado ? d.reservas.filter((r) => r.evento_id === selecionado.id && r.estado !== "cancelado").length : 0;

  const notasPorCarro = useMemo(() => anotacoesPorVeiculo(d.anotacoes), [d.anotacoes]);
  const pedidosDoSel = useMemo(() => d.desejados.filter((p) => p.evento_id === selecionadoId), [d.desejados, selecionadoId]);
  const modoEvento = objetivo === "evento" && !!selecionado;

  /** Período do evento: o previsto no formulário ou, sem ele, o das reservas que já tem. */
  const periodoDoSel = useMemo(() => {
    if (!selecionado) return null;
    if (selecionado.chegada_prevista && selecionado.retirada_prevista) return { inicio: selecionado.chegada_prevista, fim: selecionado.retirada_prevista };
    const rs = d.reservas.filter((r) => r.evento_id === selecionado.id && r.estado !== "cancelado");
    if (!rs.length) return null;
    const inicio = rs.map((r) => r.reserva_inicio).sort()[0]!;
    const fins = rs.map((r) => r.reserva_fim).filter((f) => !f.startsWith("9999")).sort();   // reserva em aberto (sem retirada) não entra na conta do período
    return { inicio, fim: fins.at(-1) ?? somarDias(inicio, 30) };
  }, [selecionado, d.reservas]);

  /** No modo "Planejar evento": os carros do evento + só os livres no período e que cabem no pedido. */
  const veiculosVisiveis = useMemo(() => {
    if (objetivo === "disponiveis") {
      // livres em TODO o intervalo: sem reserva aberta, sem manutenção que bloqueie e ainda na frota (não devolvido)
      const oficina = manutencoesPorVeiculo(d.manutencoes);
      return d.veiculos.filter((v) => (reservavelPeloCiclo(v.status_ciclo) || (!!disponivelAPartirDe(v) && periodoDisp.inicio >= disponivelAPartirDe(v)!)) && conflitos(periodoDisp, ctxUso.reservas.get(v.id) ?? []).length === 0 && manutencoesQueBloqueiam(periodoDisp, oficina.get(v.id) ?? []).length === 0);
    }
    if (!modoEvento || !selecionado) return d.veiculos;
    const oficina = manutencoesPorVeiculo(d.manutencoes);
    const doEvento = new Set(d.reservas.filter((r) => r.evento_id === selecionado.id && r.estado !== "cancelado").map((r) => r.veiculo_id));
    return d.veiculos.filter((v) => doEvento.has(v.id) || ((reservavelPeloCiclo(v.status_ciclo) || !!disponivelAPartirDe(v)) && cabeNosPedidos(v, pedidosDoSel)
      && (!periodoDoSel || (conflitos(periodoDoSel, ctxUso.reservas.get(v.id) ?? [], selecionado.id).length === 0 && manutencoesQueBloqueiam(periodoDoSel, oficina.get(v.id) ?? []).length === 0))));
  }, [objetivo, periodoDisp, modoEvento, selecionado, d.veiculos, d.reservas, d.manutencoes, pedidosDoSel, periodoDoSel, ctxUso]);
  const eventosVisiveis = modoEvento && selecionado ? [selecionado] : d.eventos;
  const nomeDoCarro = (id: string | null | undefined) => { const v = d.veiculos.find((x) => x.id === id); return v ? (v.codigo ?? v.modelo.toUpperCase()) : "?"; };

  const editarVeiculo: OnEditar<Veiculo> = async (linha, campo, valor) => { await atualizarCampos(linha.id, { [campo.edicao!.coluna]: valor } as Partial<Veiculo>); toast("Salvo"); };
  const alterarReserva = async (_v: Veiculo, barra: Barra, modo: ModoDeArrasto, delta: number) => {
    if (ehBarraDeManutencao(barra)) { await d.moverManutencao(barra.id, modo, delta); return; }
    if (ehBarraDeAnotacao(barra)) { const n = aplicarArrasto({ inicio: barra.inicio, fim: barra.fim }, modo, delta); await d.moverNota(barra.id, n.inicio, n.fim); return; }
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
            <label className="plan-objetivo"><span className="t-body-sm t-muted">Objetivo</span>
              <Select aria-label="Objetivo do planejamento" value={objetivo} onChange={(e) => { const o = e.target.value as "geral" | "evento" | "disponiveis" | "financeiro"; setObjetivo(o); if (o !== "evento") setSelecionadoId(null); else if (!selecionadoId && d.eventos?.[0]) setSelecionadoId(d.eventos[0].id); }}>
                <option value="geral">Visão geral</option><option value="evento">Planejar evento</option><option value="disponiveis">Veículos disponíveis</option><option value="financeiro">Financeiro</option>
              </Select></label>
            {objetivo === "disponiveis" && (<>
              <label className="plan-objetivo"><span className="t-body-sm t-muted">De</span><DateField value={de} onChange={(e) => { setDe(e.target.value); if (ate && e.target.value > ate) setAte(e.target.value); }} aria-label="Disponível a partir de" /></label>
              <label className="plan-objetivo"><span className="t-body-sm t-muted">Até</span><DateField value={ate} onChange={(e) => setAte(e.target.value)} aria-label="Disponível até" /></label>
            </>)}
            {objetivo === "evento" && (
              <label className="plan-objetivo"><span className="t-body-sm t-muted">Evento</span>
                <Select aria-label="Evento a planejar" value={selecionadoId ?? ""} placeholder="Escolher evento…" onChange={(e) => { if (e.target.value === "__novo__") setCriando(true); else setSelecionadoId(e.target.value || null); }}>
                  {(d.eventos ?? []).map((ev) => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
                  <option value="__novo__">＋ Criar novo evento…</option>
                </Select></label>
            )}
          </div>
        </div>

        {objetivo === "financeiro" && <PainelFinanceiro d={d} />}

        {objetivo !== "financeiro" && <section aria-label="Veículos" className="ds-stack" data-testid="pane-veiculos">
          <h2 className="t-h3">{objetivo === "disponiveis" ? `Veículos disponíveis de ${formatarDiaBr(periodoDisp.inicio)}${periodoDisp.fim !== periodoDisp.inicio ? ` a ${formatarDiaBr(periodoDisp.fim)}` : ""}` : "Veículos"}</h2>
          <TelaDoMotor<Veiculo> tela="planejamento-veiculos" extrasDaPrimeira={(ls) => <BotoesDeCopia veiculos={ls} />} selecaoInicial={idsDaUrl("veiculos")} acoesDaSelecao={({ ids, limpar }) => <AcoesDosVeiculosSelecionados d={d} ids={ids} limpar={limpar} semPlanejamento />} titulo="Veículos" subtitulo="" compacta modoFixo="timeline" eixo={eixo}
            linhas={d.eventos ? veiculosVisiveis : null} erro={d.erro} campos={camposVeiculo} idDe={(v) => v.id} onEditar={editarVeiculo} onAbrir={(v) => abrirNoLugar(`/veiculos/${v.id}`)}
            linhaDoTempo={{ barrasDe: (v) => [...barrasDoVeiculo(ctxUso.reservas.get(v.id) ?? [], nomeDoEvento, selecionadoId), ...barrasDeManutencao(d.manutencoesDoCarro.get(v.id) ?? [], ctxUso.hoje), ...barrasDeAnotacao(notasPorCarro.get(v.id) ?? [])], onAlterarBarra: alterarReserva, onCriarNaData: (v, data) => criacao.abrirNoDia(v.id, data),
              onAbrirBarra: (_v, b) => { if (ehBarraDeManutencao(b)) navigate(`/manutencoes/${b.id}`); else if (ehBarraDeAnotacao(b)) criacao.editarNota(b.id); else { const id = (b.dados as { eventoId: string }).eventoId; setSelecionadoId(id); } } }}
            rotuloDoTotal={(n) => `${n} veículo${n === 1 ? "" : "s"}`} placeholderDaBusca="Buscar carro…" alturaDaLinhaDoTempo="38dvh" larguraEsquerda={LARGURA_ESQUERDA}
            vazio={objetivo === "disponiveis" ? <p className="t-body t-muted">Nenhum veículo livre em todo esse intervalo.</p> : modoEvento ? <p className="t-body t-muted">Nenhum carro livre nessas datas que caiba no pedido do evento.</p> : <p className="t-body t-muted">Nenhum veículo cadastrado ainda.</p>} />
        </section>}

        {objetivo !== "disponiveis" && objetivo !== "financeiro" && <section aria-label="Eventos" className="ds-stack" data-testid="pane-eventos">
          <h2 className="t-h3">Eventos</h2>
          {selecionado && (
            <Card><div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }} data-testid="evento-selecionado">
              <span className="t-body"><b>{selecionado.nome}</b> · {carrosDoSelecionado} carro{carrosDoSelecionado === 1 ? "" : "s"} reservado{carrosDoSelecionado === 1 ? "" : "s"}. As reservas dele estão destacadas nos carros.</span>
              <span className="ds-row" style={{ flexWrap: "wrap" }}>
                <Button size="sm" onClick={() => setReservando(true)} data-testid="reservar-para-selecionado">Reservar carros</Button>
                <Button size="sm" variant="secondary" onClick={() => abrirNoLugar(`/eventos/${selecionado.id}`)}>Abrir evento</Button>
                <Button size="sm" variant="ghost" icon={<X size={16} />} onClick={() => setSelecionadoId(null)} aria-label="Limpar seleção">Limpar</Button>
              </span>
            </div></Card>
          )}
          {modoEvento && <PedidosDoEvento pedidos={pedidosDoSel} codigoDoCarro={(rid) => { const r = d.reservas.find((x) => x.id === rid); return r ? nomeDoCarro(r.veiculo_id) : null; }} onNaoAtendido={d.marcarNaoAtendido} />}
          <TelaDoMotor<Evento> tela="planejamento-eventos" selecaoInicial={idsDaUrl("eventos")} titulo="Eventos" subtitulo="" compacta modoFixo="timeline" eixo={eixo}
            linhas={d.eventos ? eventosVisiveis : null} erro={d.erro} campos={d.campos} idDe={(e) => e.id} onEditar={d.editarEvento} onAbrir={(e) => abrirNoLugar(`/eventos/${e.id}`)} selecionadoId={selecionadoId} aoSelecionar={(e) => setSelecionadoId((atual) => (atual === e.id ? null : e.id))}
            linhaDoTempo={{ barrasDe: (e) => barraDoEvento(e, d.ctx.reservasDoEvento.get(e.id) ?? []), onAlterarBarra: d.moverEvento as never, onAbrirBarra: (e) => setSelecionadoId(e.id) }}
            rotuloDoTotal={(n) => `${n} evento${n === 1 ? "" : "s"}`} placeholderDaBusca="Buscar evento…" alturaDaLinhaDoTempo="30dvh" larguraEsquerda={LARGURA_ESQUERDA}
            vazio={<p className="t-body t-muted">Nenhum evento ainda. Crie o primeiro em “Novo evento”.</p>} />
        </section>}
      </div>

      {selecionado && <AdicionarVeiculos aberto={reservando} onFechar={() => setReservando(false)} evento={selecionado} veiculos={d.veiculos} reservas={d.reservas} eventos={d.eventos ?? []} manutencoes={d.manutencoes} pedidos={d.desejados} onNaoAtendido={d.marcarNaoAtendido}
        onReservar={(ids, ini, fim, janela) => d.reservar(selecionado.id, ids, ini, fim, janela)} />}
      <NovoEvento aberto={criando} onFechar={() => setCriando(false)} onCriar={d.criar} onCriado={(e) => { setObjetivo("evento"); setSelecionadoId(e.id); setReservando(true); }} />
      {criacao.dialogos}
      <AvisoDeChecklistEmMassa d={d} />
    </div>
  );
}
