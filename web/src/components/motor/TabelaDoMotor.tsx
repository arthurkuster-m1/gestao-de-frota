import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CaretDown, CaretRight, CaretUp } from "@phosphor-icons/react";
import { Badge, cx } from "../../ds";
import { aplicarConsulta, type ValorDoCampo } from "../../lib/motor/consulta";
import { formatarDiaBr, hojeLocal } from "../../lib/motor/datas";
import { limitarLargura, resolverColunas, type PreferenciasDaTabela } from "../../lib/motor/layout";
import { proximaOrdenacao } from "../../lib/motor/ordenar-por-coluna";
import type { CampoDaTela } from "./tipos";
import "./motor.css";

type Props<T> = {
  linhas: readonly T[]; campos: readonly CampoDaTela<T>[]; prefs: PreferenciasDaTabela; onPrefs: (p: PreferenciasDaTabela) => void;
  idDe: (l: T) => string; onAbrir?: (l: T) => void; vazio: ReactNode; rotuloDoTotal?: (n: number) => string;
};

function formatar<T>(c: CampoDaTela<T>, l: T): ReactNode {
  if (c.celula) return c.celula(l);
  const v: ValorDoCampo = c.valorDe(l);
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return <span className="mt-vazio">—</span>;
  if (c.tipo === "caixa") return v === true ? <Badge tone="info">Sim</Badge> : <span className="mt-vazio">Não</span>;
  if (c.tipo === "data") return formatarDiaBr(String(v));
  if (c.tipo === "opcao") {
    const o = c.opcoes?.find((x) => x.value === v);
    return o?.tom ? <Badge tone={o.tom}>{o.label}</Badge> : (o?.label ?? String(v));
  }
  if (Array.isArray(v)) return v.map((x) => c.rotuloDoValor?.(x) ?? x).join(", ");
  return String(v);
}

/** O contêiner da tabela só existe quando há linhas: o efeito precisa rodar de novo quando ele aparece. */
const semLinhasInicial = (n: number) => n === 0;

export function TabelaDoMotor<T>({ linhas, campos, prefs, onPrefs, idDe, onAbrir, vazio, rotuloDoTotal }: Props<T>) {
  const colunas = useMemo(() => resolverColunas(campos, prefs).filter((c) => c.visivel), [campos, prefs]);
  const resultado = useMemo(() => aplicarConsulta(linhas, campos, prefs, { hoje: hojeLocal() }), [linhas, campos, prefs]);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [arrastando, setArrastando] = useState<{ id: string; largura: number } | null>(null);
  const campoPorId = useMemo(() => new Map(campos.map((c) => [c.id, c])), [campos]);

  const larguraDe = (c: { id: string; largura: number }) => (arrastando?.id === c.id ? arrastando.largura : c.largura);
  // Largura disponível: no celular, congelar colunas demais esconderia o resto. Congela só enquanto couber em ~55% da tela
  // (a primeira coluna sempre, se foi pedida).
  const caixa = useRef<HTMLDivElement>(null);
  const [disponivel, setDisponivel] = useState(0);
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    const ler = () => setDisponivel(el.clientWidth);
    ler(); const ro = new ResizeObserver(ler); ro.observe(el); return () => ro.disconnect();
  }, [semLinhasInicial(linhas.length)]);
  const pedidas = Math.min(prefs.congelar ?? 1, colunas.length);
  let congeladas = 0, somaCong = 0;
  for (let i = 0; i < pedidas; i++) { const w = larguraDe(colunas[i]!); if (i > 0 && disponivel > 0 && somaCong + w > disponivel * 0.55) break; somaCong += w; congeladas++; }
  const esquerda: number[] = []; let acc = 0;
  colunas.forEach((c, i) => { esquerda[i] = acc; if (i < congeladas) acc += larguraDe(c); });
  const total = colunas.reduce((s, c) => s + larguraDe(c), 0);
  const ordemAtual = prefs.ordenacao?.[0];

  const redimensionar = (e: React.PointerEvent, id: string, largura: number) => {
    e.preventDefault(); e.stopPropagation();
    const alvo = e.currentTarget as HTMLElement; alvo.setPointerCapture(e.pointerId);
    const x0 = e.clientX; let ultima = largura;
    const mover = (ev: PointerEvent) => { ultima = limitarLargura(largura + ev.clientX - x0); setArrastando({ id, largura: ultima }); };
    const soltar = () => { alvo.removeEventListener("pointermove", mover); alvo.removeEventListener("pointerup", soltar); setArrastando(null); onPrefs({ ...prefs, larguras: { ...prefs.larguras, [id]: ultima } }); };
    alvo.addEventListener("pointermove", mover); alvo.addEventListener("pointerup", soltar);
  };

  const celulaStyle = (i: number) => (i < congeladas ? { position: "sticky" as const, left: esquerda[i] } : undefined);
  const classeCongelada = (i: number) => cx(i < congeladas && "mt-cong", i === congeladas - 1 && "mt-cong--ultima");
  const linha = (l: T) => (
    <tr key={idDe(l)} onClick={onAbrir ? () => onAbrir(l) : undefined} data-testid="linha-motor" className={onAbrir ? "is-link" : undefined}>
      {colunas.map((c, i) => <td key={c.id} style={celulaStyle(i)} className={classeCongelada(i)}>{formatar(campoPorId.get(c.id)!, l)}</td>)}
    </tr>
  );
  const semLinhas = resultado.linhas.length === 0;

  return (
    <div className="mt-tabela-wrap">
      {semLinhas ? <div className="mt-sem">{linhas.length === 0 ? vazio : <p className="t-body t-muted">Nada bate com os filtros desta visualização.</p>}</div> : (
        <div className="mt-tabela" data-testid="tabela-motor" ref={caixa}>
          <table style={{ width: total, tableLayout: "fixed" }}>
            <colgroup>{colunas.map((c) => <col key={c.id} style={{ width: larguraDe(c) }} />)}</colgroup>
            <thead>
              <tr>{colunas.map((c, i) => {
                const ativa = ordemAtual?.campo === c.id;
                return (
                  <th key={c.id} style={celulaStyle(i)} className={classeCongelada(i)} aria-sort={ativa ? (ordemAtual.direcao === "asc" ? "ascending" : "descending") : undefined} data-col={c.id}
                    onClick={() => onPrefs({ ...prefs, ordenacao: proximaOrdenacao(prefs.ordenacao, c.id) })}>
                    <span className="mt-th">{campoPorId.get(c.id)?.titulo}{ativa && (ordemAtual.direcao === "asc" ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />)}</span>
                    <span className="mt-alca" role="separator" aria-label={`Largura de ${campoPorId.get(c.id)?.titulo}`} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => redimensionar(e, c.id, c.largura)} />
                  </th>
                );
              })}</tr>
            </thead>
            <tbody>
              {resultado.grupos ? resultado.grupos.map((g) => {
                const fechado = fechados.has(g.chave);
                const campoG = campoPorId.get(prefs.agrupar ?? "");
                return [
                  <tr key={`g-${g.chave}`} className="mt-grupo" data-testid="grupo-motor">
                    <td colSpan={colunas.length}><button type="button" className="mt-grupo__btn" aria-expanded={!fechado} onClick={() => setFechados((s) => { const n = new Set(s); if (n.has(g.chave)) n.delete(g.chave); else n.add(g.chave); return n; })}>
                      {fechado ? <CaretRight size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}<b>{g.rotulo || `Sem ${campoG?.titulo.toLowerCase() ?? "valor"}`}</b><span className="mt-grupo__n">{g.linhas.length}</span></button></td>
                  </tr>,
                  ...(fechado ? [] : g.linhas.map(linha)),
                ];
              }) : resultado.linhas.map(linha)}
            </tbody>
          </table>
        </div>
      )}
      <p className="t-body-sm t-muted mt-total" data-testid="total-motor">{rotuloDoTotal ? rotuloDoTotal(resultado.linhas.length) : `${resultado.linhas.length} registros`}{resultado.linhas.length !== linhas.length ? ` de ${linhas.length}` : ""}</p>
    </div>
  );
}
