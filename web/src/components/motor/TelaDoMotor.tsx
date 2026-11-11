import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Button, Card, Page, Skeleton, cx } from "../../ds";
import { useVisoes } from "../../lib/motor/useVisoes";
import type { PreferenciasDaTabela } from "../../lib/motor/layout";
import { prefsIguais } from "../../lib/motor/prefs";
import { NOME_DA_VISAO_PADRAO, configSegura, type VisaoSalva } from "../../lib/motor/visoes";
import { BarraDeVisualizacoes, layoutDe, type Layout } from "./BarraDeVisualizacoes";
import { BarraDeConsulta, ChipsDeFiltro } from "./BarraDeConsulta";
import { ChipsRapidos, filtrarPorChips, type ConfigDeChips, type SelecaoDeChips } from "./ChipsRapidos";
import { CartoesDoMotor } from "./CartoesDoMotor";
import { TabelaDoMotor } from "./TabelaDoMotor";
import { LinhaDoTempoDoMotor } from "./LinhaDoTempoDoMotor";
import { useEixoDoTempo, type EixoDoTempo } from "./useEixoDoTempo";
import type { Barra, ModoDeArrasto } from "../../lib/linhaDoTempo/tipos";
import type { CampoDaTela } from "./tipos";
import type { OnEditar } from "./useEdicao";
import "./motor.css";

type Props<T> = {
  /** Identifica a tela nas visualizações salvas ("veiculos", "eventos"…). */
  tela: string; titulo: string; subtitulo: string; acoes?: ReactNode; avisos?: ReactNode;
  /** Ações extras da barra que aparece ao selecionar linhas (a barra já traz "Filtrar seleção" e "Limpar"). */
  acoesDaSelecao?: (c: { ids: string[]; itens: T[]; limpar: () => void }) => ReactNode;
  /** Algo no canto do título da primeira coluna (botões de copiar…): recebe as linhas que estão filtradas. */
  extrasDaPrimeira?: (linhas: T[]) => ReactNode;
  extrasDaColuna?: (campoId: string, linhas: T[]) => ReactNode;
  /** Ícone na primeira coluna da tabela (o carro, o evento…). */
  iconeDaPrimeira?: ReactNode;
  /** Abre a tela já filtrada por estes ids (ex.: "Visualizar no Planejamento"). */
  selecaoInicial?: readonly string[];
  /** Canto superior direito do cabeçalho (ex.: o seletor de subpáginas de Eventos). */ cabecalhoDireita?: ReactNode;
  linhas: readonly T[] | null; erro: string | null; campos: readonly CampoDaTela<T>[]; idDe: (l: T) => string;
  onEditar: OnEditar<T>; onAbrir: (l: T) => void; vazio: ReactNode; rotuloDoTotal: (n: number) => string; placeholderDaBusca: string;
  /** Janelas e outros elementos por cima da tela (ex.: a janela do veículo). */
  filhos?: ReactNode;
  /** Liga a visão Linha do tempo: como cada linha vira barras e o que acontece ao arrastá-las. */
  linhaDoTempo?: {
    barrasDe: (l: T) => Barra[];
    onAlterarBarra?: (linha: T, barra: Barra, modo: ModoDeArrasto, delta: number) => Promise<void>;
    onAbrirBarra?: (linha: T, barra: Barra) => void;
    /** Duplo clique num dia vazio da linha do tempo (criar evento, manutenção, anotação…). */
    onCriarNaData?: (linha: T, data: string) => void;
  };
  /**
   * Visualizações FIXAS de fábrica depois da "Todas" (não se apagam nem se renomeiam): cada uma já vem com filtros, ordem e colunas
   * (`prefs`), que a pessoa pode ajustar e salvar (o ajuste fica guardado e passa a valer no lugar do de fábrica).
   */
  visoesFixas?: readonly { id: string; rotulo: string; prefs: PreferenciasDaTabela }[];
  /** Liga uma visualização FIXA depois da "Todas", com chips pré-montadas (ex.: "Por modelo"). */
  chipsRapidos?: ConfigDeChips<T>;
  /** Usado pelo Planejamento: eixo do tempo COMPARTILHADO entre duas telas, visão fixa em linha do tempo, sem cabeçalho grande. */
  eixo?: EixoDoTempo; modoFixo?: "timeline"; compacta?: boolean; selecionadoId?: string | null; aoSelecionar?: (l: T) => void; alturaDaLinhaDoTempo?: string; larguraEsquerda?: number;
};

/** A moldura da tela. Fica FORA da função da tela de propósito: um componente criado a cada render faria React desmontar e montar tudo de novo. */
function Casca({ compacta, tela, children }: { compacta?: boolean; tela: string; children: ReactNode }) {
  return compacta ? <div data-testid={`tela-${tela}`}>{children}</div> : <Page wide>{children}</Page>;
}

/**
 * A casca de toda tela de lista do Frota: cabeçalho, abas de visualização (salvas), Filtrar/Ordenar/Agrupar/Propriedades,
 * Tabela ⇄ Cards, busca e a edição no lugar. Veículos, Eventos e as próximas telas só trazem os campos e os dados.
 */
export function TelaDoMotor<T>({ tela, titulo, subtitulo, acoes, avisos, cabecalhoDireita, acoesDaSelecao, extrasDaPrimeira, extrasDaColuna, iconeDaPrimeira, visoesFixas, selecaoInicial, linhas, erro, campos, idDe, onEditar, onAbrir, vazio, rotuloDoTotal, placeholderDaBusca, filhos, chipsRapidos, linhaDoTempo, eixo: eixoExterno, modoFixo, compacta, selecionadoId, aoSelecionar, alturaDaLinhaDoTempo, larguraEsquerda }: Props<T>) {
  const eixoProprio = useEixoDoTempo("dia");
  const eixo = eixoExterno ?? eixoProprio;
  const v = useVisoes(tela);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  /** "Filtrar seleção": a visualização passa a mostrar só estas linhas (não é salvo na visualização). */
  const chaveInicial = (selecaoInicial ?? []).join(",");
  const [soSelecao, setSoSelecao] = useState<Set<string> | null>(() => (selecaoInicial?.length ? new Set(selecaoInicial) : null));
  useEffect(() => { if (selecaoInicial?.length) setSoSelecao(new Set(selecaoInicial)); }, [chaveInicial]);   // eslint-disable-line react-hooks/exhaustive-deps
  const selecao = useMemo(() => ({
    ids: selecionados,
    alternar: (id: string) => setSelecionados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
    definir: (ids: Set<string>) => setSelecionados(new Set(ids)),
    alternarVarios: (ids: string[], marcar: boolean) => setSelecionados((s) => { const n = new Set(s); for (const id of ids) { if (marcar) n.add(id); else n.delete(id); } return n; }),
  }), [selecionados]);
  const [abaId, setAbaId] = useState("todas");
  const [rascunho, setRascunho] = useState<PreferenciasDaTabela | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [filtroNovo, setFiltroNovo] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erroVisao, setErroVisao] = useState<string | null>(null);

  /** A "Todas" também é salva no banco (uma linha reservada, escondida das abas), para valer em qualquer aparelho. */
  const naFixa = !!chipsRapidos && abaId === chipsRapidos.id;
  const fixaDeFabrica = visoesFixas?.find((f) => f.id === abaId);
  const nomeDaBaseSalva = naFixa ? `__${chipsRapidos!.id}__` : fixaDeFabrica ? `__${fixaDeFabrica.id}__` : NOME_DA_VISAO_PADRAO; // linha reservada (escondida das abas) de Todas ou da fixa aberta
  const linhaPadrao: VisaoSalva | undefined = v.visoes.find((x) => x.nome === nomeDaBaseSalva);
  const todasSalva: PreferenciasDaTabela = useMemo(() => (linhaPadrao ? configSegura(linhaPadrao.config) : fixaDeFabrica?.prefs ?? {}), [linhaPadrao, fixaDeFabrica]);
  const ordemDasAbas = useMemo(() => v.visoes.find((x) => x.nome === "__ordem-das-abas__")?.config.ordemDasAbas ?? [], [v.visoes]);
  const abas = useMemo(() => v.visoes.filter((x) => !/^__.+__$/.test(x.nome)), [v.visoes]);
  const ativa: VisaoSalva | undefined = abas.find((x) => x.id === abaId);
  const abaValida = abaId === "todas" || naFixa || !!fixaDeFabrica || !!ativa || v.carregando;
  const [rapidos, setRapidos] = useState<SelecaoDeChips>([null, null]);
  useEffect(() => { if (!abaValida) setAbaId("todas"); }, [abaValida]);
  const base = ativa ? ativa.config : todasSalva;
  const prefs = rascunho ?? base;
  const alterada = rascunho !== null && !prefsIguais(rascunho, base);
  const onPrefs = (p: PreferenciasDaTabela) => setRascunho(p);
  const irParaAba = (id: string) => { setAbaId(id); setRascunho(null); setErroVisao(null); };
  const modo: "tabela" | "cards" | "timeline" = modoFixo === "timeline" ? "timeline" : prefs.visualizacao === "galeria" ? "cards" : prefs.visualizacao === "timeline" && linhaDoTempo ? "timeline" : "tabela";

  const layouts: readonly Layout[] = linhaDoTempo ? ["tabela", "galeria", "timeline"] : ["tabela", "galeria"];
  const doChip = useMemo(() => (naFixa && linhas ? filtrarPorChips(linhas, chipsRapidos!, rapidos) : linhas), [naFixa, linhas, chipsRapidos, rapidos]);
  const aposSelecao = useMemo(() => (soSelecao && doChip ? doChip.filter((x) => soSelecao.has(idDe(x))) : doChip), [soSelecao, doChip, idDe]);
  const buscadas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q || !aposSelecao) return aposSelecao ?? [];
    return aposSelecao.filter((x) => campos.some((c) => c.tipo === "texto" && String(c.valorDe(x) ?? "").toLowerCase().includes(q)));
  }, [aposSelecao, busca, campos]);

  async function comAviso<R>(fn: () => Promise<R>): Promise<R | undefined> { setOcupado(true); setErroVisao(null); try { return await fn(); } catch (e) { setErroVisao((e as Error).message); throw e; } finally { setOcupado(false); } }

  return (
    <Casca compacta={compacta} tela={tela}>
      <div className="ds-stack">
        {!compacta && <div className="mt-cabecalho"><div><h1 className="t-h1">{titulo}</h1><p className="t-body t-muted">{subtitulo}</p></div>{cabecalhoDireita}</div>}
        {avisos}

        <BarraDeVisualizacoes<T> sobreposto={selecionados.size > 0 ? (
          <div className="mt-selbar" role="toolbar" aria-label="Ações da seleção" data-testid="barra-selecao">
            <b>{selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"}</b>
            <Button size="sm" onClick={() => { setSoSelecao(new Set(selecionados)); setSelecionados(new Set()); }} data-testid="filtrar-selecao">Filtrar seleção</Button>
            {acoesDaSelecao?.({ ids: [...selecionados], itens: (linhas ?? []).filter((x) => selecionados.has(idDe(x))) as T[], limpar: () => setSelecionados(new Set()) })}
            <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>Limpar seleção</Button>
          </div>
        ) : undefined} visoes={abas} abaId={abaId} onAba={irParaAba} alterada={alterada} ocupado={ocupado} erro={erroVisao ?? v.erro}
          layoutAtivo={modo === "cards" ? "galeria" : modo === "timeline" ? "timeline" : "tabela"} layoutsDisponiveis={layouts} layoutFixo={!!modoFixo}
          campos={campos} prefs={prefs} onPrefs={onPrefs}
          onNovoLayout={async (layout: Layout, nome: string) => { const nova = await comAviso(() => v.criar(nome, layout, { visualizacao: layout })); if (nova) irParaAba(nova.id); }}
          onSalvarComo={async (nome) => { const nova = await comAviso(() => v.criar(nome, prefs.visualizacao ?? "tabela", prefs)); if (nova) irParaAba(nova.id); }}
          onSalvar={async () => {
            if (!rascunho) return;
            const tipo = layoutDe({ tipo: "tabela", config: rascunho });
            if (ativa) await comAviso(() => v.atualizar(ativa.id, { config: rascunho, tipo: layoutDe({ tipo: ativa.tipo, config: rascunho }) }));
            else await comAviso(() => v.salvarPadrao(nomeDaBaseSalva, tipo, rascunho));
            setRascunho(null);
          }}
          onDescartar={() => setRascunho(null)}
          onRenomear={async (id, nome) => { await comAviso(() => v.atualizar(id, { nome })); }}
          onDuplicar={async (x) => { const nova = await comAviso(() => v.criar(`${x.nome} (cópia)`, x.tipo, ativa?.id === x.id ? prefs : x.config)); if (nova) irParaAba(nova.id); }}
          onExcluir={async (id) => { await comAviso(() => v.excluir(id)); irParaAba("todas"); }}
          ordemDasAbas={ordemDasAbas} onReordenar={async (ids) => { await comAviso(async () => { const salvas = new Set(abas.map((x) => x.id)); await v.reordenar(ids.filter((id) => salvas.has(id))); await v.salvarPadrao("__ordem-das-abas__", "tabela", { ordemDasAbas: ids }); }); }}
          acoes={acoes} fixas={[...(chipsRapidos ? [{ id: chipsRapidos.id, rotulo: chipsRapidos.rotulo }] : []), ...(visoesFixas ?? []).map((f) => ({ id: f.id, rotulo: f.rotulo }))]} nomeDaBase={naFixa ? chipsRapidos!.rotulo : fixaDeFabrica ? fixaDeFabrica.rotulo : "Todas"}
          ferramentas={<>
            <BarraDeConsulta campos={campos} linhas={linhas ?? []} consulta={prefs} onChange={(c) => onPrefs({ ...prefs, ...c })} aoAdicionar={setFiltroNovo} />
            <div className="mt-busca">
              {buscando || busca ? (
                <input value={busca} autoFocus={buscando} onChange={(e) => setBusca(e.target.value)} onBlur={(e) => { const campo = e.currentTarget; window.setTimeout(() => { if (!campo.value) setBuscando(false); }, 250); }} onKeyDown={(e) => { if (e.key === "Escape") { setBusca(""); setBuscando(false); } }}
                  placeholder={placeholderDaBusca} aria-label={`Buscar em ${titulo}`} data-testid="campo-busca" />
              ) : null}
              <button type="button" className={cx("mt-btn", "mt-btn--icone", !!busca && "is-on")} aria-label="Abrir busca" title="Buscar" data-testid="abrir-busca" onClick={() => { if (busca) { setBusca(""); setBuscando(false); } else setBuscando(!buscando); }}><MagnifyingGlass size={18} /></button>
            </div>
          </>} />

        {naFixa && linhas && <ChipsRapidos cfg={chipsRapidos!} linhas={linhas} selecao={rapidos} onSelecao={setRapidos} ordem={prefs.ordemDosChips ?? []} onOrdem={(o) => onPrefs({ ...prefs, ordemDosChips: o })} arquivados={prefs.chipsArquivados ?? []} onArquivados={(a) => onPrefs({ ...prefs, chipsArquivados: a })} />}

        <ChipsDeFiltro campos={campos} linhas={linhas ?? []} consulta={prefs} onChange={(c) => onPrefs({ ...prefs, ...c })} abrirIndice={filtroNovo} aoAbrir={() => setFiltroNovo(null)} aoAdicionar={setFiltroNovo} />

        {soSelecao && (
          <div className="mt-chips" data-testid="chip-selecao"><span className="mt-chip is-on"><b>Seleção</b><span className="mt-chip__valor">{soSelecao.size} {soSelecao.size === 1 ? "item" : "itens"}</span>
            <button type="button" className="mt-chip__lixo" aria-label="Tirar o filtro da seleção" title="Mostrar tudo de novo" onClick={() => setSoSelecao(null)} data-testid="tirar-filtro-selecao">✕</button></span></div>
        )}
        {erro ? <Card><p className="t-body" role="alert">Não consegui carregar {titulo.toLowerCase()}: {erro}</p></Card>
          : !linhas ? <Card><Skeleton h={24} /><div style={{ height: 8 }} /><Skeleton h={24} /><div style={{ height: 8 }} /><Skeleton h={24} /></Card>
          : modo === "timeline" && linhaDoTempo
            ? <LinhaDoTempoDoMotor extrasDaPrimeira={extrasDaPrimeira} selecao={selecao} linhas={buscadas} campos={campos} prefs={prefs} onPrefs={compacta ? undefined : onPrefs} idDe={idDe} eixo={eixo} barrasDe={linhaDoTempo.barrasDe} onAlterarBarra={linhaDoTempo.onAlterarBarra} onAbrirBarra={linhaDoTempo.onAbrirBarra} onCriarNaData={linhaDoTempo.onCriarNaData} onAbrir={onAbrir} onEditar={onEditar} vazio={vazio} rotuloDoTotal={rotuloDoTotal} selecionadoId={selecionadoId} aoSelecionar={aoSelecionar} comControles={!eixoExterno} alturaMax={alturaDaLinhaDoTempo} larguraEsquerda={larguraEsquerda} />
          : modo === "cards"
            ? <CartoesDoMotor linhas={buscadas} campos={campos} prefs={prefs} idDe={idDe} onAbrir={onAbrir} rotuloDoTotal={rotuloDoTotal} onEditar={onEditar} vazio={vazio} />
            : <TabelaDoMotor iconeDaPrimeira={iconeDaPrimeira} extrasDaPrimeira={extrasDaPrimeira} extrasDaColuna={extrasDaColuna} selecao={selecao} linhas={buscadas} campos={campos} prefs={prefs} onPrefs={onPrefs} idDe={idDe} onAbrir={onAbrir} rotuloDoTotal={rotuloDoTotal} onEditar={onEditar} vazio={vazio} aoNovoFiltro={setFiltroNovo} />}
      </div>
      {filhos}
    </Casca>
  );
}
