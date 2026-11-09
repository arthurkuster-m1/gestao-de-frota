import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowSquareOut, CaretDown, CaretRight, X } from "@phosphor-icons/react";
import { Segmented, cx } from "../../ds";
import { aplicarArrasto } from "../../lib/linhaDoTempo/arrasto";
import { gerarDias, larguraDoPeriodo, mesesDoEixo, nomeDoMes, posicaoDoDia } from "../../lib/linhaDoTempo/eixo";
import { empilhar, totalDeFaixas } from "../../lib/linhaDoTempo/faixas";
import type { Barra, ModoDeArrasto } from "../../lib/linhaDoTempo/tipos";
import { aplicarConsulta } from "../../lib/motor/consulta";
import { diaDaSemanaDaChave, diferencaEmDias, hojeLocal, somarDias } from "../../lib/motor/datas";
import { limitarLargura, resolverColunas, type PreferenciasDaTabela } from "../../lib/motor/layout";
import { CampoEditavel } from "./CampoEditavel";
import { formatar } from "./formatar";
import type { CampoDaTela } from "./tipos";
import { useEdicao, type OnEditar } from "./useEdicao";
import type { EixoDoTempo } from "./useEixoDoTempo";
import "./motor.css";

type Props<T> = {
  linhas: readonly T[]; campos: readonly CampoDaTela<T>[]; prefs: PreferenciasDaTabela; idDe: (l: T) => string; eixo: EixoDoTempo;
  barrasDe: (l: T) => Barra[];
  /** O usuário arrastou uma barra (`delta` dias). Rejeita com `Error(mensagem)` se o banco recusar. */
  onAlterarBarra?: (linha: T, barra: Barra, modo: ModoDeArrasto, delta: number) => Promise<void>;
  /** Com isto, as colunas da parte fixa se redimensionam arrastando a borda do título (grava em `larguras`, como na tabela). */
  onPrefs?: (p: PreferenciasDaTabela) => void;
  /** Duplo clique num dia vazio da linha: `data` (aaaa-mm-dd) na linha `l`. */
  onCriarNaData?: (l: T, data: string) => void;
  onAbrir?: (l: T) => void; onAbrirBarra?: (l: T, b: Barra) => void; onEditar?: OnEditar<T>;
  vazio: ReactNode; rotuloDoTotal?: (n: number) => string;
  /** Linha escolhida (Planejamento: o evento selecionado). */ selecionadoId?: string | null; aoSelecionar?: (l: T) => void;
  /** Mostra os botões Hoje e Dia/Semana acima da linha do tempo. */ comControles?: boolean; alturaMax?: string;
  /** Largura (px) do bloco da esquerda. Duas linhas do tempo que dividem o eixo (Planejamento) usam a mesma, para os dias alinharem. */ larguraEsquerda?: number;
};

const ALTURA_FAIXA = 28, ALTURA_MIN = 48;

export function LinhaDoTempoDoMotor<T>({ linhas, campos, prefs, onPrefs, onCriarNaData, idDe, eixo, barrasDe, onAlterarBarra, onAbrir, onAbrirBarra, onEditar, vazio, rotuloDoTotal, selecionadoId, aoSelecionar, comControles = true, alturaMax, larguraEsquerda }: Props<T>) {
  const ed = useEdicao<T>(idDe, onEditar);
  const rolagem = useRef<HTMLDivElement>(null);
  const ignorar = useRef(false);
  const [largura, setLargura] = useState(0);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [arrasto, setArrasto] = useState<{ linhaId: string; barraId: string; modo: ModoDeArrasto; delta: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<{ id: string; largura: number } | null>(null);
  const { origem, dias, larguraDia, escala } = eixo;
  const hoje = hojeLocal();
  const larguraEixo = dias * larguraDia;

  const porId = useMemo(() => new Map(campos.map((c) => [c.id, c])), [campos]);
  const visiveis = useMemo(() => resolverColunas(campos, prefs).filter((c) => c.visivel), [campos, prefs]);
  const resultado = useMemo(() => aplicarConsulta(linhas, campos, prefs, { hoje }), [linhas, campos, prefs, hoje]);

  // colunas do lado esquerdo: as primeiras N visíveis (N = quantas estão "congeladas"), limitadas a ~50% da tela
  const quantas = Math.max(1, prefs.congelar ?? 1);
  /** A pessoa escolheu as propriedades da parte fixa (em qualquer coluna, até as escondidas da tabela); senão, as primeiras colunas congeladas. */
  const escolhidas = useMemo(() => {
    const ids = new Set(prefs.esquerdaLinhaDoTempo ?? []);
    const cols = resolverColunas(campos, prefs).filter((c) => ids.has(c.id));
    return cols.length > 0 ? cols : visiveis.slice(0, quantas);
  }, [campos, prefs, visiveis, quantas]);
  const colunasEsq = useMemo(() => {
    const out: { id: string; largura: number }[] = []; let soma = 0;
    for (const c of escolhidas) { const w = Math.min(ajuste?.id === c.id ? ajuste.largura : c.largura, largura > 0 ? Math.round(largura * 0.5) : c.largura); if (out.length > 0 && largura > 0 && soma + w > largura * 0.5) break; out.push({ id: c.id, largura: w }); soma += w; }
    if (larguraEsquerda && out.length > 0) {   // largura combinada: a primeira coluna absorve a diferença
      const alvo = largura > 0 ? Math.min(larguraEsquerda, Math.round(largura * 0.5)) : larguraEsquerda;
      const resto = out.slice(1).reduce((s, c) => s + c.largura, 0);
      out[0] = { ...out[0]!, largura: Math.max(110, alvo - resto) };
    }
    return out;
  }, [escolhidas, largura, larguraEsquerda, ajuste]);
  const larguraEsq = colunasEsq.reduce((s, c) => s + c.largura, 0);
  const navegaveis = colunasEsq.filter((c) => porId.get(c.id)?.edicao).map((c) => c.id);

  useEffect(() => { const el = rolagem.current; if (!el) return; const ler = () => setLargura(el.clientWidth); ler(); const ro = new ResizeObserver(ler); ro.observe(el); return () => ro.disconnect(); }, []);
  // rolagem controlada pelo eixo (compartilhada entre painéis)
  useLayoutEffect(() => {
    const el = rolagem.current; const x = eixo.scrollX;
    if (!el || x === null) return;
    const alvo = Math.round(x + larguraEsq * 0); // o eixo começa logo depois da coluna esquerda
    if (Math.abs(el.scrollLeft - alvo) > 1) { ignorar.current = true; el.scrollLeft = alvo; window.setTimeout(() => { ignorar.current = false; }, 60); }
  }, [eixo.scrollX, larguraEsq, larguraEixo]);
  // primeira vez: olhar para hoje
  useEffect(() => { if (eixo.scrollX === null) eixo.irParaHoje(); }, [eixo]);

  const dados = useMemo(() => {
    const linhaDe = (l: T) => {
      const barras = barrasDe(l).filter((b) => b.fim >= origem);
      const emp = empilhar(barras);
      return { l, id: idDe(l), emp, faixas: totalDeFaixas(emp) };
    };
    return resultado.grupos ? resultado.grupos.map((g) => ({ chave: g.chave, rotulo: g.rotulo, linhas: g.linhas.map(linhaDe) })) : [{ chave: "", rotulo: "", linhas: resultado.linhas.map(linhaDe) }];
  }, [resultado, barrasDe, idDe, origem]);

  const redimensionar = (e: React.PointerEvent, id: string, atual: number) => {
    if (!onPrefs) return;
    e.preventDefault(); e.stopPropagation();
    const alvo = e.currentTarget as HTMLElement; alvo.setPointerCapture(e.pointerId);
    const x0 = e.clientX; let ultima = atual;
    const mover = (ev: PointerEvent) => { ultima = limitarLargura(atual + ev.clientX - x0); setAjuste({ id, largura: ultima }); };
    const soltar = () => { alvo.removeEventListener("pointermove", mover); alvo.removeEventListener("pointerup", soltar); setAjuste(null); onPrefs({ ...prefs, larguras: { ...prefs.larguras, [id]: ultima } }); };
    alvo.addEventListener("pointermove", mover); alvo.addEventListener("pointerup", soltar);
  };

  const aoRolarDoUsuario = () => { const el = rolagem.current; if (!el || ignorar.current) return; eixo.aoRolar(el.scrollLeft, Math.max(0, el.clientWidth - larguraEsq)); };

  function comecarArrasto(e: React.PointerEvent, linha: T, barra: Barra) {
    const alvo = e.target as HTMLElement;
    const modo: ModoDeArrasto = alvo.dataset.alca === "inicio" ? "inicio" : alvo.dataset.alca === "fim" ? "fim" : "mover";
    if ((modo === "mover" && !barra.movel) || (modo !== "mover" && !barra.esticavel)) { return; }
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId);
    const x0 = e.clientX; let delta = 0; const linhaId = idDe(linha);
    setArrasto({ linhaId, barraId: barra.id, modo, delta: 0 });
    const mover = (ev: PointerEvent) => { delta = Math.round((ev.clientX - x0) / larguraDia); setArrasto({ linhaId, barraId: barra.id, modo, delta }); };
    const soltar = () => {
      el.removeEventListener("pointermove", mover); el.removeEventListener("pointerup", soltar); setArrasto(null);
      if (delta === 0) { onAbrirBarra?.(linha, barra); return; }
      if (onAlterarBarra) void onAlterarBarra(linha, barra, modo, delta).then(() => setErro(null), (er: Error) => setErro(er.message));
    };
    el.addEventListener("pointermove", mover); el.addEventListener("pointerup", soltar);
  }

  const dias_ = useMemo(() => gerarDias(origem, dias), [origem, dias]);
  /** Semanas de domingo a sábado ("08/11 - 14/11"); a primeira e a última podem ser parciais, cortadas pela borda do eixo. */
  const semanas = useMemo(() => {
    const fimEixo = somarDias(origem, dias - 1), out: { domingo: string; de: string; dias: number; rotulo: string; temHoje: boolean }[] = [];
    const dm = (c: string) => `${c.slice(8, 10)}/${c.slice(5, 7)}`;
    for (let dom = somarDias(origem, -((diaDaSemanaDaChave(origem) + 1) % 7)); dom <= fimEixo; dom = somarDias(dom, 7)) {
      const sab = somarDias(dom, 6), de = dom < origem ? origem : dom, ate = sab > fimEixo ? fimEixo : sab;
      out.push({ domingo: dom, de, dias: diferencaEmDias(de, ate) + 1, rotulo: `${dm(dom)} - ${dm(sab)}`, temHoje: hoje >= dom && hoje <= sab });
    }
    return out;
  }, [origem, dias, hoje]);
  const meses = useMemo(() => mesesDoEixo(origem, dias), [origem, dias]);
  const grade = { backgroundImage: "linear-gradient(to right, var(--color-border) 1px, transparent 1px)", backgroundSize: `${escala === "dia" ? larguraDia : larguraDia * 7}px 100%` } as const;
  const posHoje = posicaoDoDia(hoje, origem, larguraDia);
  const total = resultado.linhas.length;

  const barra = (linha: T, b: Barra, faixa: number) => {
    const emArrasto = arrasto && arrasto.linhaId === idDe(linha) && arrasto.barraId === b.id ? arrasto : null;
    const periodo = emArrasto ? aplicarArrasto({ inicio: b.inicio, fim: b.fim }, emArrasto.modo, emArrasto.delta) : { inicio: b.inicio, fim: b.fim };
    const esq = posicaoDoDia(periodo.inicio, origem, larguraDia);
    const larg = larguraDoPeriodo(periodo.inicio, periodo.fim, larguraDia);
    if (esq + larg < 0 || esq > larguraEixo) return null;
    const segmentos = emArrasto && emArrasto.modo !== "mover" ? undefined : b.segmentos;
    return (
      <div key={b.id} className={cx("mt-tl__barra", `mt-tl__barra--${b.tom}`, b.destaque && "is-destaque", emArrasto && "is-arrastando", (b.movel || b.esticavel) && "is-movel")} data-testid="barra-tl" data-barra={b.id}
        style={{ left: esq, width: Math.max(larg, 10), top: 8 + faixa * ALTURA_FAIXA, height: ALTURA_FAIXA - 4 }} title={`${b.rotulo} · ${periodo.inicio.slice(8, 10)}/${periodo.inicio.slice(5, 7)} a ${periodo.fim.slice(8, 10)}/${periodo.fim.slice(5, 7)}`}
        onPointerDown={(e) => comecarArrasto(e, linha, b)} onClick={(e) => { if (!b.movel && !b.esticavel) { e.stopPropagation(); onAbrirBarra?.(linha, b); } }}>
        {segmentos?.map((s, i) => <span key={i} className={cx("mt-tl__seg", `mt-tl__seg--${s.tom}`, s.tipo === "logistica" && "is-logistica")} style={{ left: posicaoDoDia(s.inicio, periodo.inicio, larguraDia), width: larguraDoPeriodo(s.inicio, s.fim, larguraDia) }} />)}
        {b.esticavel && <span className="mt-tl__alca mt-tl__alca--ini" data-alca="inicio" />}
        <span className="mt-tl__rotulo">{b.rotulo}</span>
        {b.esticavel && <span className="mt-tl__alca mt-tl__alca--fim" data-alca="fim" />}
      </div>
    );
  };

  const linhaDeDados = (d: (typeof dados)[number]["linhas"][number]) => {
    const alt = Math.max(ALTURA_MIN, d.faixas * ALTURA_FAIXA + 16);
    return (
      <div key={d.id} className={cx("mt-tl__linha", selecionadoId === d.id && "is-sel")} style={{ height: alt }} data-testid="linha-tl">
        <div className="mt-tl__esq" style={{ width: larguraEsq }}>
          {colunasEsq.map((c, i) => {
            const campo = porId.get(c.id)!;
            const primeira = i === 0;
            return (
              <div key={c.id} className="mt-tl__celula" style={{ width: c.largura }} data-campo={c.id}
                onClick={primeira && aoSelecionar ? () => aoSelecionar(d.l) : undefined}>
                {primeira ? (
                  <span className="mt-primeira">
                    <span className={cx("mt-primeira__txt", aoSelecionar && "mt-tl__selecionavel")}>{ed.editavel && campo.edicao && !aoSelecionar ? <CampoEditavel linha={d.l} campo={campo} ed={ed} navegaveis={navegaveis} /> : formatar(campo, d.l)}</span>
                    {onAbrir && <button type="button" className="mt-abrir mt-abrir--fixo" aria-label="Abrir ficha" onClick={(e) => { e.stopPropagation(); onAbrir(d.l); }}><ArrowSquareOut size={16} /></button>}
                  </span>
                ) : <CampoEditavel linha={d.l} campo={campo} ed={ed} navegaveis={navegaveis} />}
              </div>
            );
          })}
        </div>
        <div className="mt-tl__corpo" style={{ width: larguraEixo, ...grade }} title={onCriarNaData ? "Duplo clique num dia para criar" : undefined}
          onDoubleClick={onCriarNaData ? (e) => { if ((e.target as HTMLElement).closest(".mt-tl__barra")) return; const x = e.clientX - e.currentTarget.getBoundingClientRect().left; if (x < 0 || x >= larguraEixo) return; onCriarNaData(d.l, somarDias(origem, Math.floor(x / larguraDia))); } : undefined}>
          <span className="mt-tl__hoje" style={{ left: posHoje + larguraDia / 2 }} aria-hidden />
          {d.emp.map(({ barra: b, faixa }) => barra(d.l, b, faixa))}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-tl-wrap" data-testid="linha-do-tempo">
      {comControles && (
        <div className="mt-tl-controles">
          <button type="button" className="mt-btn" onClick={() => eixo.irParaHoje()} data-testid="tl-hoje">Hoje</button>
          <Segmented options={[{ value: "dia", label: "Dia" }, { value: "semana", label: "Semana" }]} value={escala} onChange={(e) => eixo.mudarEscala(e)} />
        </div>
      )}
      {(ed.erro || erro) && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{ed.erro ?? erro}</span><button type="button" aria-label="Fechar aviso" onClick={() => { ed.setErro(null); setErro(null); }}><X size={16} /></button></p>}
      {total === 0 ? <div className="mt-sem">{linhas.length === 0 ? vazio : <p className="t-body t-muted">Nada bate com os filtros desta visualização.</p>}</div> : (
        <div className="mt-tl" ref={rolagem} onScroll={aoRolarDoUsuario} style={alturaMax ? { maxHeight: alturaMax } : undefined} data-testid="rolagem-tl">
          <div className="mt-tl__grade" style={{ width: larguraEsq + larguraEixo, ["--esq" as string]: `${larguraEsq}px` }}>
            <div className="mt-tl__cabecalho">
              <div className="mt-tl__esq mt-tl__cab-esq" style={{ width: larguraEsq }}>{colunasEsq.map((c) => <div key={c.id} className="mt-tl__celula mt-tl__cab" style={{ width: c.largura }}>{porId.get(c.id)?.titulo}{onPrefs && <span className="mt-alca" role="separator" aria-label={`Largura de ${porId.get(c.id)?.titulo}`} onPointerDown={(e) => redimensionar(e, c.id, c.largura)} />}</div>)}</div>
              <div className="mt-tl__eixo" style={{ width: larguraEixo }}>
                <div className="mt-tl__meses">{meses.map((m) => <div key={m.chave} className="mt-tl__mes" style={{ width: m.dias * larguraDia }}><span>{nomeDoMes(m.chave)}</span></div>)}</div>
                <div className="mt-tl__dias" style={{ width: larguraEixo }}>
                  {escala === "dia"
                    ? dias_.map((d) => { const dow = new Date(d + "T12:00:00Z").getUTCDay(); return <div key={d} className={cx("mt-tl__dia", (dow === 0 || dow === 6) && "is-fds", d === hoje && "is-hoje")} style={{ width: larguraDia }} title={d}><b>{d.slice(8, 10)}</b><span>{"DSTQQSS"[dow]}</span></div>; })
                    : semanas.map((w) => <div key={w.domingo} className={cx("mt-tl__semana", w.temHoje && "is-hoje")} style={{ left: posicaoDoDia(w.de, origem, larguraDia), width: w.dias * larguraDia }} title={`${w.rotulo}`}>{w.rotulo}</div>)}
                </div>
              </div>
            </div>
            {dados.map((g) => (
              <section key={g.chave || "tudo"}>
                {resultado.grupos && (
                  <div className="mt-tl__grupo" style={{ width: larguraEsq + larguraEixo }}>
                    <button type="button" className="mt-grupo__btn" aria-expanded={!fechados.has(g.chave)} onClick={() => setFechados((s) => { const n = new Set(s); if (n.has(g.chave)) n.delete(g.chave); else n.add(g.chave); return n; })}>
                      {fechados.has(g.chave) ? <CaretRight size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}<b>{g.rotulo || `Sem ${porId.get(prefs.agrupar ?? "")?.titulo.toLowerCase() ?? "valor"}`}</b><span className="mt-grupo__n">{g.linhas.length}</span>
                    </button>
                  </div>
                )}
                {!fechados.has(g.chave) && g.linhas.map(linhaDeDados)}
              </section>
            ))}
          </div>
        </div>
      )}
      <p className="t-body-sm t-muted mt-total" data-testid="total-motor">{rotuloDoTotal ? rotuloDoTotal(total) : `${total} registros`}{total !== linhas.length ? ` de ${linhas.length}` : ""}</p>
    </div>
  );
}
