import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CalendarBlank, CalendarCheck, Copy, Plus, Table } from "@phosphor-icons/react";
import { Button, EmptyState, useToast } from "../../ds";
import { copiarTabela, tabelaDeVeiculosParaOutlook } from "../../lib/eventos/linhasDoEvento";
import { usePopover } from "../../ds/popover";
import { TelaDoMotor } from "../../components/motor/TelaDoMotor";
import { VISOES_FIXAS_DE_EVENTOS } from "../../lib/eventos/visoesFixas";
import { barraDoEvento } from "../../lib/eventos/barras";
import type { Evento } from "../../lib/eventos/tipos";
import { AvisoDeChecklistEmMassa } from "../checklists/AvisoDeChecklistEmMassa";
import { SubpaginasDeEventos } from "./SubpaginasDeEventos";
import { NovoEvento } from "./NovoEvento";
import { JanelaDoEventoLigada } from "./JanelaDoEventoLigada";
import type { AbaDoEvento } from "./JanelaDoEvento";
import { useDadosDeEventos } from "./useDadosDeEventos";

/** A lista de eventos; abrir um evento abre o painel lateral dele (Dados, Veículos, Transportes, Contratos), que pode ser expandido para a tela cheia. */
export function Eventos() {
  const navigate = useNavigate();
  const { id: idAberto } = useParams<{ id?: string }>();
  const d = useDadosDeEventos();
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useSearchParams();
  const aba: AbaDoEvento = (["dados", "veiculos", "transportes", "contratos"] as const).find((x) => x === busca.get("aba")) ?? "dados";

  const toast = useToast();
  /** Copia (para o Outlook) a tabela dos carros dos eventos selecionados: Código, Placa, VIN, Modelo, Cor, MY. */
  async function copiarCarros(ids: string[]) {
    const veiculosPorId = new Map(d.veiculos.map((v) => [v.id, v]));
    const vistos = new Set<string>();
    const lista = [...d.reservas, ...d.reservasSemData].filter((r) => ids.includes(r.evento_id) && r.estado !== "cancelado").flatMap((r) => { const v = veiculosPorId.get(r.veiculo_id); if (!v || vistos.has(v.id)) return []; vistos.add(v.id); return [v]; });
    if (lista.length === 0) { toast("Os eventos selecionados não têm carros definidos"); return; }
    toast((await copiarTabela(tabelaDeVeiculosParaOutlook(lista))) ? `Tabela de ${lista.length} carro${lista.length === 1 ? "" : "s"} copiada: cole no Outlook` : "Não consegui copiar. Libere a área de transferência no navegador.");
  }
  const aberto = idAberto && d.eventos ? (d.eventos.find((x) => x.id === idAberto) ?? null) : null;
  useEffect(() => { if (idAberto && d.eventos && !d.eventos.some((x) => x.id === idAberto)) navigate("/eventos", { replace: true }); }, [idAberto, d.eventos, navigate]);

  return (
    <>
      <TelaDoMotor<Evento> tela="eventos" visoesFixas={VISOES_FIXAS_DE_EVENTOS} acoesDaSelecao={({ ids }) => <><Button size="sm" variant="secondary" icon={<Copy size={16} />} onClick={() => void copiarCarros(ids)} data-testid="sel-copiar">Copiar tabela dos carros</Button><Button size="sm" variant="secondary" icon={<CalendarBlank size={16} />} onClick={() => navigate(`/planejamento?eventos=${ids.join(",")}`)} data-testid="sel-ver-planejamento">Visualizar no Planejamento</Button></>} titulo="Eventos" subtitulo="Solicitações de uso, com os carros reservados em cada uma." cabecalhoDireita={<SubpaginasDeEventos ativa="eventos" />}
        acoes={<NovoMenuDeEventos aoNovo={() => setCriando(true)} />}
        linhas={d.eventos} erro={d.erro} campos={d.campos} idDe={(x) => x.id} onEditar={d.editarEvento} onAbrir={(x) => navigate(`/eventos/${x.id}`)}
        linhaDoTempo={{ barrasDe: (e) => barraDoEvento(e, d.ctx.reservasDoEvento.get(e.id) ?? []), onAlterarBarra: d.moverEvento as never, onAbrirBarra: (e) => navigate(`/eventos/${e.id}`) }}
        rotuloDoTotal={(n) => `${n} evento${n === 1 ? "" : "s"}`} placeholderDaBusca="Buscar evento, tipo, solicitante…"
        vazio={<EmptyState icon={<CalendarCheck size={30} />} title="Nenhum evento ainda" action={<Button icon={<Plus size={20} />} onClick={() => setCriando(true)}>Criar o primeiro</Button>}>Crie o evento e depois escolha os carros. O Status de uso e a Agenda de cada carro se atualizam sozinhos.</EmptyState>}
        filhos={<JanelaDoEventoLigada d={d} id={aberto?.id ?? null} aba={aba} onAba={(a) => setBusca(a === "dados" ? {} : { aba: a }, { replace: true })} onFechar={() => navigate("/eventos")} onExcluido={() => navigate("/eventos")} />} />
      <AvisoDeChecklistEmMassa d={d} />
      <NovoEvento aberto={criando} onFechar={() => setCriando(false)} onCriar={d.criar} onCriado={(e) => navigate(`/eventos/${e.id}?aba=veiculos`)} />
    </>
  );
}

/** Botão único "Novo": um evento (janela) ou importação em massa (página inteira). */
function NovoMenuDeEventos({ aoNovo }: { aoNovo: () => void }) {
  const gatilho = useRef<HTMLSpanElement>(null);
  const { ref, aberto, setAberto } = usePopover(gatilho, { largura: 260 });
  const navigate = useNavigate();
  const estilo = { width: "100%", border: 0, background: "transparent", color: "inherit", font: "inherit" } as const;
  return (
    <span ref={gatilho} style={{ display: "inline-flex" }}>
      <Button icon={<Plus size={20} />} onClick={() => setAberto(!aberto)} aria-haspopup="menu" aria-expanded={aberto} data-testid="novo-evento">Novo</Button>
      <div ref={ref} popover="auto" role="menu" className="ds-pop" data-testid="novo-evento-lista">
        <button type="button" role="menuitem" className="ds-pop__opcao" style={estilo} onClick={() => { setAberto(false); aoNovo(); }}><span>Adicionar novo evento</span><Plus size={18} /></button>
        <button type="button" role="menuitem" className="ds-pop__opcao" style={estilo} onClick={() => { setAberto(false); navigate("/eventos/massa"); }}><span>Importar em massa</span><Table size={18} /></button>
      </div>
    </span>
  );
}
