import { useRef, useState, type ReactNode } from "react";
import { CaretDown, ChartBarHorizontal, Copy, Plus, Rows, SlidersHorizontal, SquaresFour, Trash } from "@phosphor-icons/react";
import { Button, Field, Input, Sheet, cx } from "../../ds";
import type { PreferenciasDaTabela } from "../../lib/motor/layout";
import { MAXIMO_DE_VISUALIZACOES, ROTULO_DO_TIPO, type TipoDeVisualizacao, type VisaoSalva } from "../../lib/motor/visoes";
import { Painel } from "./Painel";
import { Propriedades } from "./Propriedades";
import type { CampoDaTela } from "./tipos";

export type Layout = "tabela" | "galeria" | "timeline";
const ICONE: Record<Layout, ReactNode> = { tabela: <Rows size={16} />, galeria: <SquaresFour size={16} />, timeline: <ChartBarHorizontal size={16} /> };
/** O layout que uma visualização mostra de verdade: o da config (que o Arthur muda dentro dela) ou, na falta, o tipo salvo. */
export const layoutDe = (v: { tipo: TipoDeVisualizacao; config: PreferenciasDaTabela }): Layout => { const l = v.config.visualizacao ?? v.tipo; return l === "galeria" || l === "timeline" ? l : "tabela"; };
const ICONE_GRANDE: Record<Layout, ReactNode> = { tabela: <Rows size={22} />, galeria: <SquaresFour size={22} />, timeline: <ChartBarHorizontal size={22} /> };
const nomeNovo = (base: string, existentes: string[]) => { if (!existentes.includes(base)) return base; let n = 2; while (existentes.includes(`${base} ${n}`)) n++; return `${base} ${n}`; };

type Props<T> = {
  visoes: VisaoSalva[]; abaId: string; onAba: (id: string) => void; alterada: boolean; ocupado?: boolean; erro?: string | null;
  /** O layout em uso na aba ativa (já com alterações não salvas). */
  layoutAtivo: Layout; layoutsDisponiveis: readonly Layout[]; layoutFixo?: boolean;
  campos: readonly CampoDaTela<T>[]; prefs: PreferenciasDaTabela; onPrefs: (p: PreferenciasDaTabela) => void;
  onNovoLayout: (layout: Layout, nome: string) => Promise<void>; onSalvarComo: (nome: string) => Promise<void>;
  onSalvar: () => Promise<void>; onDescartar: () => void;
  onRenomear: (id: string, nome: string) => Promise<void>; onDuplicar: (v: VisaoSalva) => Promise<void>; onExcluir: (id: string) => Promise<void>;
  /** Ícones à direita (filtrar, ordenar, agrupar, busca) e os botões de ação da tela (ex.: Novo). */
  ferramentas: ReactNode; acoes?: ReactNode;
};

/**
 * A linha de visualizações, como no Notion: as abas (cada uma com o ícone do seu layout), o "+" com os modelos de visualização e, no canto direito,
 * os ícones pequenos de filtrar/ordenar/agrupar/buscar, a configuração da visualização (nome, layout, propriedades, duplicar, apagar) e o botão de ação.
 */
export function BarraDeVisualizacoes<T>({ visoes, abaId, onAba, alterada, ocupado, erro, layoutAtivo, layoutsDisponiveis, layoutFixo, campos, prefs, onPrefs, onNovoLayout, onSalvarComo, onSalvar, onDescartar, onRenomear, onDuplicar, onExcluir, ferramentas, acoes }: Props<T>) {
  const [salvandoComo, setSalvandoComo] = useState(false);
  const [excluindo, setExcluindo] = useState<VisaoSalva | null>(null);
  const [nome, setNome] = useState("");
  const [nomeEditado, setNomeEditado] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const engrenagem = useRef<HTMLButtonElement>(null);
  const estavaAberta = useRef(false);
  const ativa = visoes.find((v) => v.id === abaId);
  const envia = async (fn: () => Promise<void>, fechar?: () => void) => { setFalha(null); try { await fn(); fechar?.(); } catch (e) { setFalha((e as Error).message); } };
  const nomes = visoes.map((v) => v.nome);

  const aba = (id: string, texto: string, layout: Layout) => (
    <button key={id} type="button" role="tab" aria-selected={abaId === id} className={cx("mt-aba", abaId === id && "is-on")} data-testid="aba"
      onPointerDown={() => { estavaAberta.current = engrenagem.current?.getAttribute("aria-expanded") === "true"; }}
      onClick={() => { if (abaId === id) { if (!estavaAberta.current) engrenagem.current?.click(); } else onAba(id); }}>
      {!layoutFixo && <span className="mt-aba__icone" aria-hidden>{ICONE[layout]}</span>}{texto}
    </button>
  );

  return (
    <div className="mt-abas-wrap">
      <div className="mt-vbar" data-testid="barra-visualizacoes">
        <div className="mt-abas" role="tablist" aria-label="Visualizações">
          {aba("todas", "Todas", abaId === "todas" ? layoutAtivo : "tabela")}
          {visoes.map((v) => aba(v.id, v.nome, v.id === abaId ? layoutAtivo : layoutDe(v)))}
          <Painel soIcone rotulo="Nova visualização" icone={<Plus size={18} />} largura={260} testid="nova-aba">
            <div className="mt-painel__corpo">
              <span className="t-body-sm t-muted">{visoes.length >= MAXIMO_DE_VISUALIZACOES ? "Limite de visualizações atingido." : "Escolha o modelo da nova visualização"}</span>
              {layoutsDisponiveis.map((l) => (
                <button key={l} type="button" className="mt-item" disabled={visoes.length >= MAXIMO_DE_VISUALIZACOES} data-testid={`modelo-${l}`} onClick={() => void envia(() => onNovoLayout(l, nomeNovo(ROTULO_DO_TIPO[l], nomes)))}>{ICONE[l]}{ROTULO_DO_TIPO[l]}</button>
              ))}
            </div>
          </Painel>
        </div>
        <div className="mt-vbar__dir">
          {alterada && (
            <div className="mt-alterada" role="status" data-testid="barra-alterada" title={ativa ? "Alterações não salvas nesta visualização" : "Alterações não salvas em Todas"}>
              <span className="mt-alterada__ponto" aria-hidden />
              <button type="button" className="mt-alterada__txt" onClick={onDescartar} data-testid={ativa ? "descartar-visao" : "restaurar-todas"}>{ativa ? "Descartar" : "Redefinir"}</button>
              <span className="mt-alterada__salvar">
                <button type="button" className="mt-alterada__ok" disabled={ocupado} onClick={() => void onSalvar()} data-testid="salvar-visao">{ativa ? "Salvar" : "Salvar em Todas"}</button>
                {!ativa && (
                  <Painel soIcone rotulo="Mais opções de salvar" icone={<CaretDown size={14} weight="bold" />} largura={240} testid="salvar-mais">
                    <div className="mt-painel__corpo"><button type="button" className="mt-item" data-testid="salvar-como" onClick={() => { setNome(""); setFalha(null); setSalvandoComo(true); }}><Copy size={18} />Salvar como visualização</button></div>
                  </Painel>
                )}
              </span>
            </div>
          )}
          {ferramentas}
          <Painel soIcone rotulo="Configurações da visualização" icone={<SlidersHorizontal size={18} />} largura={440} testid="painel-propriedades" gatilhoRef={engrenagem}>
            <div className="mt-painel__corpo" data-testid="configuracao-da-visao">
              {ativa ? (
                <Field label="Nome da visualização"><Input value={nomeEditado ?? ativa.nome} aria-label="Nome da visualização" maxLength={60} onChange={(e) => setNomeEditado(e.target.value)}
                  onBlur={() => { if (nomeEditado !== null && nomeEditado.trim() && nomeEditado.trim() !== ativa.nome) void envia(() => onRenomear(ativa.id, nomeEditado.trim())); setNomeEditado(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></Field>
              ) : <span className="t-body" style={{ fontWeight: 700 }}>Todas <span className="t-body-sm t-muted">(visualização padrão)</span></span>}
              {!layoutFixo && layoutsDisponiveis.length > 1 && (
                <Field label="Layout"><div className="mt-layouts" role="radiogroup" aria-label="Layout">
                  {layoutsDisponiveis.map((l) => <button key={l} type="button" role="radio" aria-checked={layoutAtivo === l} className={cx("mt-layout", layoutAtivo === l && "is-on")} data-testid={`layout-${l}`} onClick={() => onPrefs({ ...prefs, visualizacao: l })}>{ICONE_GRANDE[l]}<span>{ROTULO_DO_TIPO[l]}</span></button>)}
                </div></Field>
              )}
              <Propriedades campos={campos} prefs={prefs} onChange={onPrefs} />
              {falha && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{falha}</p>}
              <div className="mt-config__rodape">
                {ativa ? (<>
                  <button type="button" className="mt-item" data-testid="duplicar-visao" onClick={() => void envia(() => onDuplicar(ativa))}><Copy size={18} />Duplicar visualização</button>
                  <button type="button" className="mt-item mt-item--perigo" data-testid="excluir-visao" onClick={() => { setFalha(null); setExcluindo(ativa); }}><Trash size={18} />Excluir visualização</button>
                </>) : (
                  <button type="button" className="mt-item" data-testid="salvar-como-config" onClick={() => { setNome(""); setFalha(null); setSalvandoComo(true); }}><Copy size={18} />Salvar como nova visualização</button>
                )}
              </div>
            </div>
          </Painel>
          {acoes && <div className="mt-vbar__acoes">{acoes}</div>}
        </div>
      </div>

      {erro && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{erro}</p>}

      <Sheet open={salvandoComo} onClose={() => setSalvandoComo(false)} title="Nova visualização">
        <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void envia(() => onSalvarComo(nome), () => setSalvandoComo(false)); }}>
          <Field label="Nome" error={falha}><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Disponíveis" maxLength={60} autoFocus /></Field>
          <p className="t-body-sm t-muted">A visualização guarda o layout, os filtros, a ordem, o agrupamento e as colunas que estão na tela agora.</p>
          <Button type="submit" size="lg" block disabled={!nome.trim()} loading={ocupado} data-testid="criar-visao">Criar visualização</Button>
        </form>
      </Sheet>
      <Sheet open={!!excluindo} onClose={() => setExcluindo(null)} title="Excluir visualização">
        <div className="ds-stack">
          <p className="t-body">Excluir <b>{excluindo?.nome}</b>? Os dados não são afetados, só essa forma de ver.</p>
          {falha && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{falha}</p>}
          <Button variant="danger" size="lg" block onClick={() => excluindo && void envia(() => onExcluir(excluindo.id), () => setExcluindo(null))} data-testid="confirmar-exclusao-visao">Excluir</Button>
        </div>
      </Sheet>
    </div>
  );
}
