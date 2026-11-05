import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowSquareOut, CaretDown, CaretRight, CaretUp, X } from "@phosphor-icons/react";
import { Badge, cx, useToast } from "../../ds";
import { aplicarConsulta, type ValorDoCampo } from "../../lib/motor/consulta";
import { formatarDiaBr, hojeLocal } from "../../lib/motor/datas";
import { limitarLargura, resolverColunas, type PreferenciasDaTabela } from "../../lib/motor/layout";
import { proximaOrdenacao } from "../../lib/motor/ordenar-por-coluna";
import { EditorDeCelula, type Movimento } from "./EditorDeCelula";
import { prepararEdicao, valorParaEditor, type ValorEditavel } from "./edicao";
import type { CampoDaTela } from "./tipos";
import "./motor.css";

type Props<T> = {
  linhas: readonly T[]; campos: readonly CampoDaTela<T>[]; prefs: PreferenciasDaTabela; onPrefs: (p: PreferenciasDaTabela) => void;
  idDe: (l: T) => string; onAbrir?: (l: T) => void; vazio: ReactNode; rotuloDoTotal?: (n: number) => string;
  /** Grava um campo editado na célula. Rejeita com `Error(mensagem)` se o banco recusar. Sem isto, a tabela é só de leitura. */
  onEditar?: (linha: T, campo: CampoDaTela<T>, valor: ValorEditavel) => Promise<void>;
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

export function TabelaDoMotor<T>({ linhas, campos, prefs, onPrefs, idDe, onAbrir, vazio, rotuloDoTotal, onEditar }: Props<T>) {
  const toast = useToast();
  const [editando, setEditando] = useState<{ id: string; campo: string } | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
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

  const editaveis = colunas.filter((c) => campoPorId.get(c.id)?.edicao).map((c) => c.id);
  const abrirEditor = (l: T, c: CampoDaTela<T>) => { setErroEdicao(null); setEditando({ id: idDe(l), campo: c.id }); };

  async function confirmar(l: T, c: CampoDaTela<T>, bruto: ValorEditavel, mover?: Movimento) {
    const prep = prepararEdicao(c.tipo, c.edicao!, bruto);
    setEditando(null);
    if (!prep.ok) { setErroEdicao(`${c.titulo}: ${prep.erro}`); return; }
    const atual = valorParaEditor(c.tipo, c.valorDe(l));
    if (prep.valor !== atual && onEditar) {
      const chave = `${idDe(l)}:${c.id}`;
      setSalvando(chave);
      try { await onEditar(l, c, prep.valor); toast("Salvo"); }
      catch (e) { setErroEdicao(`${c.titulo}: ${(e as Error).message}`); setSalvando(null); return; }
      setSalvando(null);
    }
    if (mover) {
      const i = editaveis.indexOf(c.id); const j = i + (mover === "proximo" ? 1 : -1);
      const alvo = editaveis[j];
      if (alvo) setEditando({ id: idDe(l), campo: alvo });
    }
  }

  const celulaStyle = (i: number) => (i < congeladas ? { position: "sticky" as const, left: esquerda[i] } : undefined);
  const classeCongelada = (i: number) => cx(i < congeladas && "mt-cong", i === congeladas - 1 && "mt-cong--ultima");
  const celula = (l: T, c: { id: string }, i: number) => {
    const campo = campoPorId.get(c.id)!;
    const chave = `${idDe(l)}:${c.id}`;
    const editavel = !!(onEditar && campo.edicao);
    const ativo = editando?.id === idDe(l) && editando.campo === c.id;
    if (ativo && campo.edicao) {
      return (
        <td key={c.id} style={celulaStyle(i)} className={cx(classeCongelada(i), "mt-editando")} data-testid="celula-editando">
          <EditorDeCelula tipo={campo.tipo} valor={valorParaEditor(campo.tipo, campo.valorDe(l))} opcoes={campo.opcoes} obrigatorio={campo.edicao.obrigatorio} edicao={campo.edicao} rotulo={campo.titulo}
            validar={(v) => { const r = prepararEdicao(campo.tipo, campo.edicao!, v); if (!r.ok) setErroEdicao(`${campo.titulo}: ${r.erro}`); else setErroEdicao(null); return r.ok ? null : r.erro; }}
            onConfirmar={(v, mover) => void confirmar(l, campo, v, mover)} onCancelar={() => setEditando(null)} />
        </td>
      );
    }
    const clique = editavel
      ? (e: React.MouseEvent) => { e.stopPropagation(); if (campo.tipo === "caixa") void confirmar(l, campo, !(campo.valorDe(l) === true)); else abrirEditor(l, campo); }
      : onAbrir ? () => onAbrir(l) : undefined;
    return (
      <td key={c.id} style={celulaStyle(i)} className={cx(classeCongelada(i), editavel && "mt-editavel", !editavel && onAbrir && "mt-abre", salvando === chave && "is-salvando")} onClick={clique} data-campo={c.id} data-editavel={editavel || undefined}>
        {i === 0 && onAbrir ? <span className="mt-primeira"><span className="mt-primeira__txt">{formatar(campo, l)}</span><button type="button" className="mt-abrir" aria-label="Abrir ficha" onClick={(e) => { e.stopPropagation(); onAbrir(l); }}><ArrowSquareOut size={16} /></button></span> : formatar(campo, l)}
      </td>
    );
  };
  const linha = (l: T) => (
    <tr key={idDe(l)} data-testid="linha-motor">
      {colunas.map((c, i) => celula(l, c, i))}
    </tr>
  );
  const semLinhas = resultado.linhas.length === 0;

  return (
    <div className="mt-tabela-wrap">
      {erroEdicao && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{erroEdicao}</span><button type="button" aria-label="Fechar aviso" onClick={() => setErroEdicao(null)}><X size={16} /></button></p>}
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
