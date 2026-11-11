import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Papa from "papaparse";
import { DataSheetGrid, keyColumn, textColumn } from "react-datasheet-grid";
import "react-datasheet-grid/dist/style.css";
import { ArrowsClockwise, CheckCircle, ClipboardText, Minus, Warning, XCircle } from "@phosphor-icons/react";
import { Button, Card, DateField, Field, Input, Page, Select, Sheet, Textarea, useToast } from "../../ds";
import { carregarDados } from "../../lib/lancamentos/dados";
import { erroDeOpcao, linhaEstaVazia, linhasDeMatriz } from "../../lib/lancamentos/matriz";
import { GRUPOS, LANCAMENTOS, lancamentoDe } from "../../lib/lancamentos/registro";
import type { Dados, Linha, Parametro, Parametros, Resultado, Tom } from "../../lib/lancamentos/tipos";
import { colunaOpcao } from "./colunaOpcao";
import "../veiculos/veiculos.css";

type LinhaGrade = Linha & { __tom?: Tom; __texto?: string };
const semMeta = ({ __tom, __texto, ...resto }: LinhaGrade): Linha => { void __tom; void __texto; return resto; };
const ICONE: Record<Tom, React.ReactNode> = { erro: <XCircle size={15} weight="fill" />, ign: <Minus size={15} />, dup: <ArrowsClockwise size={15} />, ok: <CheckCircle size={15} weight="fill" /> };
const classeLinha = ({ rowData }: { rowData: LinhaGrade }) => (rowData.__tom ? `ds-massa__linha is-${rowData.__tom}` : undefined);
const vazias = (n: number): Linha[] => Array.from({ length: n }, () => ({}));
const horaAgora = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
const COLUNA_SITUACAO = {
  id: "situacao", title: "Situação da linha", minWidth: 380, basis: 420, grow: 1, disabled: true,
  component: ({ rowData }: { rowData: LinhaGrade }) => (rowData.__tom && rowData.__tom !== "ign" ? <span className={`ds-massa__status is-${rowData.__tom}`} title={rowData.__texto}>{ICONE[rowData.__tom]}<span>{rowData.__texto}</span></span> : null),
  copyValue: ({ rowData }: { rowData: LinhaGrade }) => rowData.__texto ?? "", pasteValue: ({ rowData }: { rowData: LinhaGrade }) => rowData, deleteValue: ({ rowData }: { rowData: LinhaGrade }) => rowData, isCellEmpty: ({ rowData }: { rowData: LinhaGrade }) => !rowData.__tom,
};

function CampoDeParametro({ p, valor, onChange }: { p: Parametro; valor: string; onChange: (v: string) => void }) {
  return (
    <Field label={p.rotulo}>
      {p.tipo === "data" ? <DateField value={valor} onChange={(e) => onChange(e.target.value)} />
        : p.tipo === "hora" ? <Input inputMode="numeric" value={valor} placeholder="14:30" maxLength={5} aria-label={p.rotulo} onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); onChange(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d); }} />
        : p.tipo === "opcao" ? <Select value={valor} onChange={(e) => onChange(e.target.value)} aria-label={p.rotulo}><option value="">Não informado</option>{p.opcoes?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
        : <Input value={valor} onChange={(e) => onChange(e.target.value)} aria-label={p.rotulo} />}
    </Field>
  );
}

/**
 * Lançamentos: um lugar só para lançar em massa qualquer coisa do app. Escolha o que lançar (faturamento, novos pedidos, eventos, manutenções…),
 * preencha ou cole a tabela (colunas de categoria têm setinha com todas as opções) e aplique. A última coluna mostra a situação de cada linha.
 */
export function Lancamentos() {
  const toast = useToast();
  const [busca, setBusca] = useSearchParams();
  const lanc = lancamentoDe(busca.get("acao"));
  const [categoriaEscolhida, setCategoriaEscolhida] = useState("");
  const categoria = lanc?.grupo ?? categoriaEscolhida;   // com uma ação aberta, a categoria é a dela
  const [dados, setDados] = useState<Dados | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>(() => vazias(8));
  const [params, setParams] = useState<Parametros>({});
  const [colando, setColando] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const recarregar = () => carregarDados().then(setDados, (e: Error) => setErro(`Não consegui carregar os dados: ${e.message}`));
  useEffect(() => { void recarregar(); }, []);

  // ao trocar de lançamento: grade limpa e parâmetros nos padrões (data de hoje, hora de agora)
  useEffect(() => {
    setLinhas(vazias(8)); setErro(null); setAviso(null);
    if (!lanc || !dados) { setParams({}); return; }
    setParams(Object.fromEntries((lanc.parametros?.(dados) ?? []).map((p) => [p.id, p.padrao ?? (p.tipo === "data" ? dados.hoje : p.tipo === "hora" ? horaAgora() : "")])));
  }, [lanc?.id, !!dados]);   // eslint-disable-line react-hooks/exhaustive-deps

  const colunasDef = useMemo(() => (lanc && dados ? lanc.colunas(dados) : []), [lanc, dados]);
  const resultados = useMemo<Resultado[]>(() => {
    if (!lanc || !dados) return linhas.map(() => ({ tom: "ign" as const, texto: "Conferindo…" }));
    const base = lanc.validar(linhas, dados, params);
    return base.map((r, i) => { const l = linhas[i]!; if (linhaEstaVazia(l)) return { tom: "ign" as const, texto: "Linha vazia" }; const e = erroDeOpcao(l, colunasDef); return e ? { tom: "erro" as const, texto: e } : r; });
  }, [lanc, dados, linhas, params, colunasDef]);
  const gradeDados: LinhaGrade[] = useMemo(() => linhas.map((l, i) => ({ ...semMeta(l), __tom: resultados[i]!.tom, __texto: resultados[i]!.texto })), [linhas, resultados]);
  const cont = useMemo(() => { const c: Record<Tom, number> = { ok: 0, erro: 0, dup: 0, ign: 0 }; for (const r of resultados) c[r.tom]++; return c; }, [resultados]);

  const colunas = useMemo(() => [
    ...colunasDef.map((c) => ({ ...keyColumn<LinhaGrade, string>(c.id, (c.opcoes ? colunaOpcao(c.opcoes) : textColumn) as never), title: c.titulo, minWidth: c.largura, basis: c.largura, grow: 0 })),
    COLUNA_SITUACAO,   // a situação é sempre a última coluna
  ], [colunasDef]);

  function adicionar(matriz: string[][]) {
    const novas = linhasDeMatriz(matriz, colunasDef);
    if (novas.length === 0) { setErro("Não encontrei linhas nesse texto."); return; }
    setErro(null);
    setLinhas((atual) => [...atual.filter((l) => !linhaEstaVazia(l)), ...novas, ...vazias(3)]);
  }

  async function aplicar() {
    if (!lanc || !dados) return;
    setEnviando(true); setErro(null); setAviso(null);
    try {
      const prontos = resultados.flatMap((r, i) => (r.tom === "ok" ? [{ indice: i, pronto: r.pronto }] : []));
      const r = await lanc.aplicar(prontos, dados, params);
      if (r.feitos.length) {
        const feitos = new Set(r.feitos);
        setLinhas((atual) => { const resto = atual.filter((_, i) => !feitos.has(i)); return resto.some((l) => !linhaEstaVazia(l)) ? resto : vazias(8); });
        toast(`${r.feitos.length} lançamento${r.feitos.length === 1 ? "" : "s"} gravado${r.feitos.length === 1 ? "" : "s"}`);
        await recarregar();
      }
      if (r.falha) setErro(`Parou: ${r.falha}${r.feitos.length ? " As linhas anteriores já foram gravadas e saíram da tabela." : ""}`);
      if (r.aviso) setAviso(r.aviso);
    } catch (x) { setErro((x as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Page wide>
      <div className="ds-stack">
        <div>
          <h1 className="t-h1">Lançamentos</h1>
          <p className="t-body t-muted">Lance em massa qualquer coisa do app, num lugar só: escolha o que lançar, preencha ou cole a tabela e aplique.</p>
        </div>

        <div className="mt-lanc__escolha" data-testid="escolher-lancamento">
          <Field label="Categoria">
            <Select value={categoria} onChange={(e) => { setCategoriaEscolhida(e.target.value); setBusca({}); }} placeholder="Escolher a categoria…" aria-label="Categoria do lançamento" data-testid="categoria-do-lancamento">
              <option value="">Escolher a categoria…</option>{GRUPOS.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>
          {categoria && (
            <Field label="Ação">
              <Select value={lanc?.id ?? ""} onChange={(e) => setBusca(e.target.value ? { acao: e.target.value } : {})} placeholder="Escolher a ação…" aria-label="Ação do lançamento" data-testid="acao-do-lancamento">
                <option value="">Escolher a ação…</option>{LANCAMENTOS.filter((l) => l.grupo === categoria).map((l) => <option key={l.id} value={l.id}>{l.rotulo}</option>)}
              </Select>
            </Field>
          )}
        </div>

        {!lanc ? <Card><p className="t-body t-muted" data-testid="escolha-um">{categoria ? "Agora escolha a ação." : "Escolha a categoria e depois a ação que você quer lançar."}</p></Card> : (
          <>
            <p className="t-body-sm t-muted" data-testid="descricao-do-lancamento">{lanc.descricao}</p>
            {dados && (lanc.parametros?.(dados) ?? []).length > 0 && (
              <div className="mt-lanc__params">{(lanc.parametros?.(dados) ?? []).map((p) => <CampoDeParametro key={p.id} p={p} valor={params[p.id] ?? ""} onChange={(v) => setParams((x) => ({ ...x, [p.id]: v }))} />)}</div>
            )}

            <div className="ds-row" style={{ flexWrap: "wrap" }}>
              <Button variant="secondary" icon={<ClipboardText size={20} />} onClick={() => setColando(true)}>Colar do Excel</Button>
              <Button variant="ghost" onClick={() => setLinhas(vazias(8))}>Limpar</Button>
            </div>

            <div>
              <div className="ds-massa vei-massa" data-testid="grade-lancamentos">
                <DataSheetGrid<LinhaGrade> height={1000000} key={lanc.id} value={gradeDados} onChange={(v) => setLinhas(v.map(semMeta))} columns={colunas} rowClassName={classeLinha} lockRows={false} gutterColumn={{ minWidth: 40 }} addRowsComponent={false} />
              </div>
            </div>

            <div className="ds-row" style={{ flexWrap: "wrap", justifyContent: "space-between" }} aria-live="polite" data-testid="resumo-lancamentos">
              <span className="t-body">
                <b>{cont.ok}</b> pronto{cont.ok === 1 ? "" : "s"}
                {cont.dup > 0 && <> · <Warning size={16} style={{ verticalAlign: "-3px" }} /> {cont.dup} sem mudança (ignorado{cont.dup === 1 ? "" : "s"})</>}
                {cont.erro > 0 && <> · <XCircle size={16} style={{ verticalAlign: "-3px" }} /> {cont.erro} com erro</>}
              </span>
              <Button size="lg" loading={enviando} disabled={!dados || cont.ok === 0 || cont.erro > 0} onClick={() => void aplicar()} data-testid="aplicar-lancamento">{lanc.botao(cont.ok)}</Button>
            </div>
            {cont.erro > 0 && <p className="t-body-sm t-muted">Corrija ou apague as linhas com erro para liberar o botão.</p>}
            {aviso && <p className="t-body-sm" role="status">{aviso}</p>}
            {erro && <p className="t-body" role="alert" style={{ color: "var(--color-error-fg)" }}>{erro}</p>}
          </>
        )}
      </div>

      <Sheet open={colando} onClose={() => setColando(false)} title="Colar do Excel" wide>
        <div className="ds-stack">
          <p className="t-body-sm t-muted">Copie as células no Excel (com ou sem a linha de títulos) e cole aqui. Colunas desta lançamento: {colunasDef.map((c) => c.titulo.split(" (")[0]).join(", ")}. Sem títulos, vale essa ordem.</p>
          <Textarea rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto colado" />
          <Button size="lg" block disabled={!texto.trim()} onClick={() => { adicionar(Papa.parse<string[]>(texto, { delimiter: "\t", skipEmptyLines: true }).data); setTexto(""); setColando(false); }}>Adicionar à grade</Button>
        </div>
      </Sheet>
    </Page>
  );
}
