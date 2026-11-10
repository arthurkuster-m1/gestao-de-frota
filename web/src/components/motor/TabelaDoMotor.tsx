import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowSquareOut, CaretDown, CaretRight, CaretUp, X } from "@phosphor-icons/react";
import { cx, useToast } from "../../ds";
import { aplicarConsulta } from "../../lib/motor/consulta";
import { hojeLocal } from "../../lib/motor/datas";
import { limitarLargura, resolverColunas, type PreferenciasDaTabela } from "../../lib/motor/layout";
import { CaixaDeSelecao, type Selecao } from "./CaixaDeSelecao";
import { ThOrdenavel } from "./ThOrdenavel";
import { MenuDaColuna } from "./MenuDaColuna";
import { EditorDeCores } from "./EditorDeCores";
import { opcoesDoCampo } from "./BarraDeConsulta";
import { EditorDeCelula } from "./EditorDeCelula";
import { prepararEdicao, valorParaEditor } from "./edicao";
import { converterColado, deTsv, intervaloDe, multiplas, paraTsv, textoDaCelula, type Ponto } from "./selecao";
import { formatar } from "./formatar";
import { useEdicao, type OnEditar } from "./useEdicao";
import type { CampoDaTela } from "./tipos";
import "./motor.css";

type Props<T> = {
  linhas: readonly T[]; campos: readonly CampoDaTela<T>[]; prefs: PreferenciasDaTabela; onPrefs: (p: PreferenciasDaTabela) => void;
  idDe: (l: T) => string; onAbrir?: (l: T) => void; vazio: ReactNode; rotuloDoTotal?: (n: number) => string;
  /** Grava um campo editado na célula. Rejeita com `Error(mensagem)` se o banco recusar. Sem isto, a tabela é só de leitura. */
  onEditar?: OnEditar<T>;
  /** Seleção de várias linhas (caixinha na primeira coluna). Sem isto, a tabela não tem caixinhas. */
  selecao?: Selecao;
  /** Avisa que o menu da coluna criou um filtro (a tela abre o editor dele). */
  aoNovoFiltro?: (indice: number) => void;
};

/** O contêiner da tabela só existe quando há linhas: o efeito precisa rodar de novo quando ele aparece. */
const semLinhasInicial = (n: number) => n === 0;

export function TabelaDoMotor<T>({ linhas, campos, prefs, onPrefs, idDe, onAbrir, vazio, rotuloDoTotal, onEditar, aoNovoFiltro, selecao }: Props<T>) {
  const ed = useEdicao<T>(idDe, onEditar);
  const colunas = useMemo(() => resolverColunas(campos, prefs).filter((c) => c.visivel), [campos, prefs]);
  const resultado = useMemo(() => aplicarConsulta(linhas, campos, prefs, { hoje: hojeLocal() }), [linhas, campos, prefs]);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [arrastando, setArrastando] = useState<{ id: string; largura: number } | null>(null);
  const campoPorId = useMemo(() => new Map(campos.map((c) => [c.id, c])), [campos]);
  const toast = useToast();
  const [coresDe, setCoresDe] = useState<CampoDaTela<T> | null>(null);
  const [menuCol, setMenuCol] = useState<{ id: string; el: HTMLElement } | null>(null);

  // Seleção de células (clicar e arrastar, como no Excel/Notion): copiar e colar usam texto tabulado.
  const [sel, setSel] = useState<{ a: Ponto; b: Ponto } | null>(null);
  const arrastandoSel = useRef(false);
  const visiveis = useMemo(() => (resultado.grupos ? resultado.grupos.filter((g) => !fechados.has(g.chave)).flatMap((g) => g.linhas) : resultado.linhas), [resultado, fechados]);
  const indiceDe = useMemo(() => new Map(visiveis.map((l, k) => [idDe(l), k])), [visiveis, idDe]);
  const faixa = sel ? intervaloDe(sel.a, sel.b) : null;
  const refs = useRef({ faixa, visiveis, colunas, onEditar });
  refs.current = { faixa, visiveis, colunas, onEditar };
  useEffect(() => {
    const solta = () => { arrastandoSel.current = false; };
    const fora = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.(".mt-tabela")) setSel(null); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setSel(null); };
    const copiar = (e: ClipboardEvent) => {
      const { faixa: f, visiveis: vs, colunas: cs } = refs.current;
      if (!f || (!multiplas(f) && window.getSelection()?.toString())) return;
      const m: string[][] = [];
      for (let r = f.l0; r <= f.l1; r++) { const l = vs[r]; if (!l) continue; m.push(cs.slice(f.c0, f.c1 + 1).map((c) => { const cp = campoPorId.get(c.id); return cp ? textoDaCelula(cp, l) : ""; })); }
      e.clipboardData?.setData("text/plain", paraTsv(m)); e.preventDefault();
      toast(multiplas(f) ? `${m.length * (f.c1 - f.c0 + 1)} células copiadas` : "Célula copiada");
    };
    const colar = (e: ClipboardEvent) => {
      const { faixa: f, visiveis: vs, colunas: cs, onEditar: grava } = refs.current;
      const alvo = e.target as HTMLElement | null;
      if (!f || !grava || alvo?.closest("input, textarea, select, [contenteditable]")) return;
      const texto = e.clipboardData?.getData("text/plain"); if (!texto) return;
      e.preventDefault();
      const m = deTsv(texto);
      const encher = m.length === 1 && m[0]!.length === 1 && multiplas(f); // 1 valor sobre vários campos: preenche todos
      const nl = encher ? f.l1 - f.l0 + 1 : m.length;
      void (async () => {
        let ok = 0, pulados = 0, erro: string | null = null;
        for (let dr = 0; dr < nl; dr++) {
          const l = vs[f.l0 + dr]; if (!l) break;
          const linhaM = encher ? m[0]! : m[dr]!;
          const nc = encher ? f.c1 - f.c0 + 1 : linhaM.length;
          for (let dc = 0; dc < nc; dc++) {
            const col = cs[f.c0 + dc]; const cp = col && campoPorId.get(col.id);
            if (!cp || !cp.edicao) { pulados++; continue; }
            const bruto = converterColado(cp, encher ? m[0]![0]! : linhaM[dc]!);
            if (bruto === undefined) { pulados++; continue; }
            const prep = prepararEdicao(cp.tipo, cp.edicao, bruto);
            if (!prep.ok) { pulados++; erro ??= `${cp.titulo}: ${prep.erro}`; continue; }
            if (prep.valor === valorParaEditor(cp.tipo, cp.valorDe(l))) continue;
            try { await grava(l, cp, prep.valor); ok++; } catch (x) { pulados++; erro ??= `${cp.titulo}: ${(x as Error).message}`; }
          }
        }
        if (erro) ed.setErro(erro);
        toast(pulados ? `${ok} colada(s), ${pulados} ignorada(s)` : `${ok} célula(s) coladas`);
      })();
    };
    window.addEventListener("mouseup", solta); document.addEventListener("mousedown", fora); document.addEventListener("keydown", tecla);
    document.addEventListener("copy", copiar); document.addEventListener("paste", colar);
    return () => { window.removeEventListener("mouseup", solta); document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla); document.removeEventListener("copy", copiar); document.removeEventListener("paste", colar); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campoPorId]);

  const larguraBruta = (c: { id: string; largura: number }) => (arrastando?.id === c.id ? arrastando.largura : c.largura);
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
  // Se a coluna congelada for mais larga que ~55% da tela (celular), ela é reduzida: senão cobriria as outras colunas.
  const larguraDe = (c: { id: string; largura: number }) => (pedidas > 0 && disponivel > 0 && c.id === colunas[0]?.id ? Math.min(larguraBruta(c), Math.round(disponivel * 0.55)) : larguraBruta(c));
  let congeladas = 0, somaCong = 0;
  for (let i = 0; i < pedidas; i++) { const w = larguraDe(colunas[i]!); if (i > 0 && disponivel > 0 && somaCong + w > disponivel * 0.55) break; somaCong += w; congeladas++; }
  const esquerda: number[] = []; let acc = 0;
  colunas.forEach((c, i) => { esquerda[i] = acc; if (i < congeladas) acc += larguraDe(c); });
  const total = colunas.reduce((s, c) => s + larguraDe(c), 0);
  const ordemAtual = prefs.ordenacao?.[0];

  // arrastar o título de uma coluna muda a ordem (grava em `ordem`, a mesma das Propriedades); colunas congeladas ficam no lugar
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const aoSoltarColuna = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const todas = resolverColunas(campos, prefs).filter((c) => !c.fixa).map((c) => c.id);
    const vis = colunas.filter((c) => !c.fixa).map((c) => c.id);
    const de = vis.indexOf(String(e.active.id)), para = vis.indexOf(String(e.over.id));
    if (de < 0 || para < 0) return;
    const nova = arrayMove(vis, de, para); let k = 0;
    onPrefs({ ...prefs, ordem: todas.map((id) => (vis.includes(id) ? nova[k++]! : id)) });
  };

  const redimensionar = (e: React.PointerEvent, id: string, largura: number) => {
    e.preventDefault(); e.stopPropagation();
    const alvo = e.currentTarget as HTMLElement; alvo.setPointerCapture(e.pointerId);
    const x0 = e.clientX; let ultima = largura;
    const mover = (ev: PointerEvent) => { ultima = limitarLargura(largura + ev.clientX - x0); setArrastando({ id, largura: ultima }); };
    const soltar = () => { alvo.removeEventListener("pointermove", mover); alvo.removeEventListener("pointerup", soltar); setArrastando(null); onPrefs({ ...prefs, larguras: { ...prefs.larguras, [id]: ultima } }); };
    alvo.addEventListener("pointermove", mover); alvo.addEventListener("pointerup", soltar);
  };

  const editaveis = colunas.filter((c) => campoPorId.get(c.id)?.edicao).map((c) => c.id);
  const celulaStyle = (i: number) => (i < congeladas ? { position: "sticky" as const, left: esquerda[i] } : undefined);
  const classeCongelada = (i: number) => cx(i < congeladas && "mt-cong", i === congeladas - 1 && "mt-cong--ultima");
  const celula = (l: T, c: { id: string }, i: number, r: number) => {
    const campo = campoPorId.get(c.id)!;
    const editavel = !!(onEditar && campo.edicao);
    if (ed.estaAberto(l, c.id) && campo.edicao) {
      return (
        <td key={c.id} style={celulaStyle(i)} className={cx(classeCongelada(i), "mt-editando")} data-testid="celula-editando">
          <EditorDeCelula campoId={campo.id} tipo={campo.tipo} valor={valorParaEditor(campo.tipo, campo.valorDe(l))} opcoes={campo.opcoes} obrigatorio={campo.edicao.obrigatorio} edicao={campo.edicao} rotulo={campo.titulo}
            validar={ed.validar(campo)} onConfirmar={(v, mover) => void ed.confirmar(l, campo, v, mover, editaveis)} onCancelar={ed.cancelar} />
        </td>
      );
    }
    const clique = editavel
      ? (e: React.MouseEvent) => { e.stopPropagation(); if (campo.tipo === "caixa") void ed.confirmar(l, campo, !(campo.valorDe(l) === true), undefined, editaveis); else ed.abrir(l, campo); }
      : onAbrir ? () => onAbrir(l) : undefined;
    const dentro = !!faixa && multiplas(faixa) && r >= faixa.l0 && r <= faixa.l1 && i >= faixa.c0 && i <= faixa.c1;
    const bordas = dentro && faixa ? cx("mt-sel", r === faixa.l0 && "mt-sel-t", r === faixa.l1 && "mt-sel-b", i === faixa.c0 && "mt-sel-l", i === faixa.c1 && "mt-sel-r") : "";
    const aoPressionar = (e: React.MouseEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest("button, input, textarea, select, a")) return;
      const p = { l: r, c: i };
      if (e.shiftKey && sel) { e.preventDefault(); setSel({ a: sel.a, b: p }); }
      else setSel({ a: p, b: p });
      arrastandoSel.current = true;
    };
    const conteudoDaCelula = i === 0 && onAbrir ? <span className="mt-primeira"><span className="mt-primeira__txt">{formatar(campo, l)}</span><button type="button" className="mt-abrir" aria-label="Abrir ficha" onClick={(e) => { e.stopPropagation(); onAbrir(l); }}><ArrowSquareOut size={16} /></button></span> : formatar(campo, l);
    return (
      <td key={c.id} style={celulaStyle(i)} onMouseDown={aoPressionar} onMouseEnter={() => { if (arrastandoSel.current) setSel((v) => (v ? { a: v.a, b: { l: r, c: i } } : v)); }} className={cx(classeCongelada(i), bordas, (prefs.quebrarLinhas ?? []).includes(c.id) && "mt-quebra", editavel && "mt-editavel", !editavel && onAbrir && "mt-abre", ed.estaSalvando(l, c.id) && "is-salvando")} onClick={clique} data-campo={c.id} data-editavel={editavel || undefined} title={campo.tipo === "texto" ? String(campo.valorDe(l) ?? "") || undefined : undefined}>
        {i === 0 && selecao ? <span className="mt-comchk"><CaixaDeSelecao marcada={selecao.ids.has(idDe(l))} onChange={() => selecao.alternar(idDe(l))} rotulo="Selecionar linha" />{conteudoDaCelula}</span> : conteudoDaCelula}
      </td>
    );
  };
  const linha = (l: T) => (
    <tr key={idDe(l)} data-testid="linha-motor" className={selecao?.ids.has(idDe(l)) ? "is-sel" : undefined}>
      {colunas.map((c, i) => celula(l, c, i, indiceDe.get(idDe(l)) ?? 0))}
    </tr>
  );
  const semLinhas = resultado.linhas.length === 0;

  return (
    <div className="mt-tabela-wrap">
      {ed.erro && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{ed.erro}</span><button type="button" aria-label="Fechar aviso" onClick={() => ed.setErro(null)}><X size={16} /></button></p>}
      <MenuDaColuna ancora={menuCol?.el ?? null} campo={menuCol ? campoPorId.get(menuCol.id) : undefined} indice={menuCol ? colunas.findIndex((c) => c.id === menuCol.id) : 0} prefs={prefs} onPrefs={onPrefs} aoFiltrar={aoNovoFiltro} aoEditarCores={setCoresDe} onFechar={() => setMenuCol(null)} />
      {coresDe && <EditorDeCores aberto onFechar={() => setCoresDe(null)} campoId={coresDe.id} titulo={coresDe.titulo} opcoes={opcoesDoCampo(coresDe, linhas)} />}
      {semLinhas ? <div className="mt-sem">{linhas.length === 0 ? vazio : <p className="t-body t-muted">Nada bate com os filtros desta visualização.</p>}</div> : (
        <div className={cx("mt-tabela", !!selecao && selecao.ids.size > 0 && "tem-sel", arrastandoSel.current && sel && multiplas(intervaloDe(sel.a, sel.b)) && "mt-selecionando")} data-testid="tabela-motor" ref={caixa}>
          <table style={{ width: total, tableLayout: "fixed" }}>
            <colgroup>{colunas.map((c) => <col key={c.id} style={{ width: larguraDe(c) }} />)}</colgroup>
            <thead>
              <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltarColuna}>
                <SortableContext items={colunas.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                  <tr>{colunas.map((c, i) => {
                    const ativa = ordemAtual?.campo === c.id;
                    return (
                      <ThOrdenavel key={c.id} id={c.id} travada={i < congeladas || !!c.fixa} estilo={celulaStyle(i)} className={classeCongelada(i)} aria-sort={ativa ? (ordemAtual.direcao === "asc" ? "ascending" : "descending") : undefined} data-col={c.id}
                        onClick={(e) => setMenuCol({ id: c.id, el: e.currentTarget })} onDoubleClick={(e) => setMenuCol({ id: c.id, el: e.currentTarget })}>
                        <span className="mt-th">{i === 0 && selecao && <CaixaDeSelecao marcada={resultado.linhas.length > 0 && resultado.linhas.every((x) => selecao.ids.has(idDe(x)))} parcial={resultado.linhas.some((x) => selecao.ids.has(idDe(x)))} onChange={(m) => selecao.alternarVarios(resultado.linhas.map(idDe), m)} rotulo="Selecionar todas as linhas" />}{campoPorId.get(c.id)?.titulo}{ativa && (ordemAtual.direcao === "asc" ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />)}</span>
                        <span className="mt-alca" role="separator" aria-label={`Largura de ${campoPorId.get(c.id)?.titulo}`} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => { e.stopPropagation(); redimensionar(e, c.id, c.largura); }} />
                      </ThOrdenavel>
                    );
                  })}</tr>
                </SortableContext>
              </DndContext>
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
