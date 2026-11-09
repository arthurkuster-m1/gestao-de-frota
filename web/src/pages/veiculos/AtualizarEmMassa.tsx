import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { DataSheetGrid, keyColumn, textColumn } from "react-datasheet-grid";
import "react-datasheet-grid/dist/style.css";
import { ArrowLeft, ArrowsClockwise, CheckCircle, ClipboardText, Minus, Warning, XCircle } from "@phosphor-icons/react";
import { Button, Card, DateField, Field, Input, Page, Segmented, Select, Sheet, Textarea, useToast } from "../../ds";
import { listarEventos, listarReservas, listarReservasSemData } from "../../lib/eventos/dados";
import type { Evento } from "../../lib/eventos/tipos";
import { hojeLocal } from "../../lib/motor/datas";
import { ACOES, acaoDe, linhasDeMatriz, validarLista, type AcaoEmMassa, type LinhaDaLista, type Resultado, type Tom } from "../../lib/veiculos/atualizacaoEmMassa";
import { listarVeiculos } from "../../lib/veiculos/dados";
import { aplicarPlanos, reservarEmMassa } from "../../lib/veiculos/executarEmMassa";
import type { Veiculo } from "../../lib/veiculos/tipos";
import "./veiculos.css";

type LinhaGrade = LinhaDaLista & { __tom?: Tom; __texto?: string };
const semMeta = ({ __tom, __texto, ...resto }: LinhaGrade): LinhaDaLista => { void __tom; void __texto; return resto; };
const ICONE: Record<Tom, React.ReactNode> = { erro: <XCircle size={15} weight="fill" />, ign: <Minus size={15} />, dup: <ArrowsClockwise size={15} />, ok: <CheckCircle size={15} weight="fill" /> };
const classeLinha = ({ rowData }: { rowData: LinhaGrade }) => (rowData.__tom ? `ds-massa__linha is-${rowData.__tom}` : undefined);
const vazias = (n: number): LinhaDaLista[] => Array.from({ length: n }, () => ({}));
const COLUNA_SITUACAO = {
  id: "situacao", title: "Situação da linha", minWidth: 380, basis: 420, grow: 1, disabled: true,
  component: ({ rowData }: { rowData: LinhaGrade }) => (rowData.__tom && rowData.__tom !== "ign" ? <span className={`ds-massa__status is-${rowData.__tom}`} title={rowData.__texto}>{ICONE[rowData.__tom]}<span>{rowData.__texto}</span></span> : null),
  copyValue: ({ rowData }: { rowData: LinhaGrade }) => rowData.__texto ?? "", pasteValue: ({ rowData }: { rowData: LinhaGrade }) => rowData, deleteValue: ({ rowData }: { rowData: LinhaGrade }) => rowData, isCellEmpty: ({ rowData }: { rowData: LinhaGrade }) => !rowData.__tom,
};

/** Atualizar em massa: escolhe a ação (emplacados, faturados, devolvidos ou reserva em evento), cola a lista e aplica a todos de uma vez. */
export function AtualizarEmMassa() {
  const navigate = useNavigate();
  const toast = useToast();
  const [acao, setAcao] = useState<AcaoEmMassa>("faturamento");
  const [linhas, setLinhas] = useState<LinhaDaLista[]>(() => vazias(8));
  const [data, setData] = useState(hojeLocal());
  const [veiculos, setVeiculos] = useState<Veiculo[] | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [vinculos, setVinculos] = useState<{ evento_id: string; veiculo_id: string }[]>([]);
  const [eventoSel, setEventoSel] = useState("");            // id do evento, ou "__novo__"
  const [nomeNovo, setNomeNovo] = useState("");
  const [colando, setColando] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const def = acaoDe(acao);

  useEffect(() => {
    Promise.all([listarVeiculos(), listarEventos(), listarReservas(), listarReservasSemData()]).then(([v, e, r, sd]) => { setVeiculos(v); setEventos(e); setVinculos([...r, ...sd]); },
      (x: Error) => setErro(`Não consegui carregar os dados: ${x.message}`));
  }, []);

  const jaNoEvento = useMemo(() => new Set(vinculos.filter((v) => v.evento_id === eventoSel).map((v) => v.veiculo_id)), [vinculos, eventoSel]);
  const resultados = useMemo<Resultado[]>(() => (veiculos ? validarLista(acao, linhas, { veiculos, data, jaNoEvento }) : linhas.map(() => ({ tom: "ign" as Tom, texto: "Conferindo…" }))), [acao, linhas, veiculos, data, jaNoEvento]);
  const dados: LinhaGrade[] = useMemo(() => linhas.map((l, i) => ({ ...semMeta(l), __tom: resultados[i]!.tom, __texto: resultados[i]!.texto })), [linhas, resultados]);
  const cont = useMemo(() => { const c: Record<Tom, number> = { ok: 0, erro: 0, dup: 0, ign: 0 }; for (const r of resultados) c[r.tom]++; return c; }, [resultados]);
  const prontos = resultados.filter((r) => r.tom === "ok");

  const colunas = useMemo(() => [
    { ...keyColumn<LinhaGrade, "ref">("ref", textColumn as never), title: def.referencia, minWidth: 300, basis: 320, grow: 0 },
    ...(def.comPlaca ? [{ ...keyColumn<LinhaGrade, "placa">("placa", textColumn as never), title: "Placa", minWidth: 130, basis: 140, grow: 0 }] : []),
    COLUNA_SITUACAO,   // por último
  ], [def]);

  function adicionar(matriz: string[][]) {
    const novas = linhasDeMatriz(matriz);
    if (novas.length === 0) { setErro("Não encontrei linhas nesse texto."); return; }
    setErro(null);
    setLinhas((atual) => [...atual.filter((l) => (l.ref ?? "").trim() || (l.placa ?? "").trim()), ...novas, ...vazias(3)]);
  }

  async function aplicar() {
    setEnviando(true); setErro(null);
    try {
      if (acao === "reserva") {
        const ids = prontos.map((r) => r.veiculo!.id);
        const alvo = eventoSel === "__novo__" ? { novoNome: nomeNovo } : eventos.find((e) => e.id === eventoSel)!;
        const r = await reservarEmMassa(ids, alvo, eventos.map((e) => e.nome));
        toast(`${ids.length} carro${ids.length === 1 ? "" : "s"} reservado${ids.length === 1 ? "" : "s"} em ${r.evento.nome}${r.sem_data ? " (sem data: defina as datas do evento)" : ""}`);
        navigate(`/eventos/${r.evento.id}?aba=veiculos`); return;
      }
      const r = await aplicarPlanos(prontos);
      if (r.feitos.length) {
        const feitos = new Set(r.feitos);
        setLinhas((atual) => atual.filter((_, i) => !(resultados[i]?.veiculo && feitos.has(resultados[i]!.veiculo!.id) && resultados[i]!.tom === "ok")));
        toast(`${r.feitos.length} veículo${r.feitos.length === 1 ? "" : "s"} atualizado${r.feitos.length === 1 ? "" : "s"}`);
        setVeiculos(await listarVeiculos());
      }
      if (r.falha) setErro(`Parou em ${r.falha.codigo}: ${r.falha.erro}. Os anteriores já foram atualizados e saíram da lista.`);
      else navigate("/veiculos");
    } catch (x) { setErro((x as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Page wide>
      <div className="ds-stack">
        <Link to="/veiculos" className="ds-row" style={{ textDecoration: "none" }}><ArrowLeft size={20} />Veículos</Link>
        <div>
          <h1 className="t-h1">Atualizar veículos em massa</h1>
          <p className="t-body t-muted">Escolha a ação, cole a lista (Ctrl+V na grade) e aplique a todos de uma vez. O ciclo de vida de cada carro acompanha.</p>
        </div>

        <Segmented options={ACOES.map((a) => ({ value: a.id, label: a.rotulo }))} value={acao} onChange={(v) => { setAcao(v as AcaoEmMassa); setErro(null); }} />
        <p className="t-body-sm t-muted" data-testid="descricao-da-acao">{def.descricao}</p>

        <div className="vei-form__linha">
          {def.comData && <Field label={acao === "faturamento" ? "Data do faturamento" : acao === "emplacamento" ? "Data do emplacamento" : "Data da devolução"}><DateField value={data} onChange={(e) => setData(e.target.value)} /></Field>}
          {acao === "reserva" && (
            <>
              <Field label="Evento"><Select value={eventoSel} onChange={(e) => setEventoSel(e.target.value)} placeholder="Escolher o evento…" aria-label="Evento da reserva"><option value="">Escolher o evento…</option>{eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}<option value="__novo__">＋ Criar um evento novo…</option></Select></Field>
              {eventoSel === "__novo__" && <Field label="Nome do novo evento (opcional)"><Input value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Em branco: EVENTO SEM DATA" maxLength={120} /></Field>}
            </>
          )}
        </div>

        <div className="ds-row" style={{ flexWrap: "wrap" }}>
          <Button variant="secondary" icon={<ClipboardText size={20} />} onClick={() => setColando(true)}>Colar lista</Button>
          <Button variant="ghost" onClick={() => setLinhas(vazias(8))}>Limpar</Button>
        </div>

        <Card flush>
          <div className="ds-massa vei-massa" data-testid="grade-atualizar-em-massa">
            <DataSheetGrid<LinhaGrade> key={acao} value={dados} onChange={(v) => setLinhas(v.map(semMeta))} columns={colunas} rowClassName={classeLinha} lockRows={false} gutterColumn={{ minWidth: 40 }} addRowsComponent={false} />
          </div>
        </Card>

        <div className="ds-row" style={{ flexWrap: "wrap", justifyContent: "space-between" }} aria-live="polite" data-testid="resumo-atualizar-em-massa">
          <span className="t-body">
            <b>{cont.ok}</b> pronto{cont.ok === 1 ? "" : "s"}
            {cont.dup > 0 && <> · <Warning size={16} style={{ verticalAlign: "-3px" }} /> {cont.dup} sem mudança (ignorado{cont.dup === 1 ? "" : "s"})</>}
            {cont.erro > 0 && <> · <XCircle size={16} style={{ verticalAlign: "-3px" }} /> {cont.erro} com erro</>}
          </span>
          <Button size="lg" loading={enviando} disabled={!veiculos || cont.ok === 0 || cont.erro > 0 || (acao === "reserva" && eventoSel === "")} onClick={() => void aplicar()} data-testid="aplicar-em-massa">
            {acao === "reserva" ? `Reservar ${cont.ok} carro${cont.ok === 1 ? "" : "s"}` : `Atualizar ${cont.ok} veículo${cont.ok === 1 ? "" : "s"}`}
          </Button>
        </div>
        {cont.erro > 0 && <p className="t-body-sm t-muted">Corrija ou apague as linhas com erro para liberar o botão.</p>}
        {erro && <p className="t-body" role="alert" style={{ color: "var(--color-error-fg)" }}>{erro}</p>}
      </div>

      <Sheet open={colando} onClose={() => setColando(false)} title="Colar a lista">
        <div className="ds-stack">
          <p className="t-body-sm t-muted">{def.comPlaca ? "Cole duas colunas do Excel: a referência (VIN ou código) e a placa." : "Cole uma referência por linha."} {def.referencia}.</p>
          <Textarea rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Lista colada" />
          <Button size="lg" block disabled={!texto.trim()} onClick={() => { adicionar(Papa.parse<string[]>(texto, { delimiter: "\t", skipEmptyLines: true }).data); setTexto(""); setColando(false); }}>Adicionar à grade</Button>
        </div>
      </Sheet>
    </Page>
  );
}
