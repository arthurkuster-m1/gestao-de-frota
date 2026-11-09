import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { DataSheetGrid, keyColumn, textColumn } from "react-datasheet-grid";
import "react-datasheet-grid/dist/style.css";
import { ArrowLeft, ArrowsClockwise, CheckCircle, ClipboardText, Minus, Warning, XCircle } from "@phosphor-icons/react";
import { Button, Card, DateField, Field, Input, Page, Select, Sheet, Textarea, cx, useToast } from "../../ds";
import { listarChecklists } from "../../lib/checklists/dados";
import { paraInstante } from "../../lib/checklists/regras";
import { COMBUSTIVEIS, LIMPEZAS } from "../../lib/checklists/tipos";
import { listarEventos, listarReservas, listarReservasSemData } from "../../lib/eventos/dados";
import type { Evento } from "../../lib/eventos/tipos";
import { hojeLocal } from "../../lib/motor/datas";
import { ACOES, acaoDe, linhasDeMatriz, validarLista, type AcaoEmMassa, type LinhaDaLista, type ReservaResumida, type Resultado, type Tom } from "../../lib/veiculos/atualizacaoEmMassa";
import { listarVeiculos } from "../../lib/veiculos/dados";
import { aplicarPlanos, registrarChecklistsEmMassa, reservarEmMassa } from "../../lib/veiculos/executarEmMassa";
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

const rotuloDaData = (a: AcaoEmMassa) => ({ liberacao: "Data da liberação", faturamento: "Data do faturamento", emplacamento: "Data do emplacamento", devolucao: "Data da devolução", saida: "Dia da saída", retorno: "Dia do retorno" } as Partial<Record<AcaoEmMassa, string>>)[a] ?? "Data";

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
  const [reservas, setReservas] = useState<ReservaResumida[]>([]);
  const [checklistsFeitos, setChecklistsFeitos] = useState<Set<string>>(new Set());
  const [hora, setHora] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()));
  const [extra, setExtra] = useState({ combustivel: "", limpeza: "", recebido: "", obs: "" });
  const [eventoSel, setEventoSel] = useState("");            // id do evento, "__novo__" (reserva) ou "" (saída/retorno: achar pelo carro)
  const [nomeNovo, setNomeNovo] = useState("");
  const [colando, setColando] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const def = acaoDe(acao);
  const horaOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);

  useEffect(() => {
    Promise.all([listarVeiculos(), listarEventos(), listarReservas(), listarReservasSemData(), listarChecklists().catch(() => [])]).then(([v, e, r, sd, ck]) => {
      setVeiculos(v); setEventos(e); setVinculos([...r, ...sd]);
      setReservas([...r, ...sd].map((x) => ({ id: x.id, veiculo_id: x.veiculo_id, evento_id: x.evento_id, estado: x.estado })));
      setChecklistsFeitos(new Set(ck.map((c) => `${c.reserva_id}:${c.momento}`)));
    },
      (x: Error) => setErro(`Não consegui carregar os dados: ${x.message}`));
  }, []);

  const jaNoEvento = useMemo(() => new Set(vinculos.filter((v) => v.evento_id === eventoSel).map((v) => v.veiculo_id)), [vinculos, eventoSel]);
  const resultados = useMemo<Resultado[]>(() => (veiculos ? validarLista(acao, linhas, { veiculos, data, jaNoEvento, reservas, checklistsFeitos, eventoId: acao === "saida" || acao === "retorno" ? eventoSel : undefined, nomeDoEvento: (id) => eventos.find((e) => e.id === id)?.nome ?? "?" }) : linhas.map(() => ({ tom: "ign" as Tom, texto: "Conferindo…" }))), [acao, linhas, veiculos, data, jaNoEvento, reservas, checklistsFeitos, eventoSel, eventos]);
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
      if (def.comChecklist) {
        const momento = acao === "saida" ? "saida" : "retorno";
        const ids = prontos.map((r) => r.reservaId!);
        await registrarChecklistsEmMassa(ids, momento, { data_hora: paraInstante(data || hojeLocal(), hora), combustivel: extra.combustivel || null, limpeza: extra.limpeza || null, recebido_por: extra.recebido.trim() || null, teve_avarias: false, avarias: null, observacoes: extra.obs.trim() || null });
        toast(`Checklist de ${momento === "saida" ? "saída" : "retorno"} registrado para ${ids.length} carro${ids.length === 1 ? "" : "s"}`);
        navigate("/eventos"); return;
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

        <div className="mt-rap" style={{ flexWrap: "wrap", overflow: "visible" }} role="tablist" aria-label="Ação em massa">
          {ACOES.map((a) => <button key={a.id} type="button" role="tab" aria-selected={acao === a.id} className={cx("mt-rap__chip", acao === a.id && "is-on")} onClick={() => { setAcao(a.id); setErro(null); setEventoSel(""); }} data-testid={`acao-${a.id}`}>{a.rotulo}</button>)}
        </div>
        <p className="t-body-sm t-muted" data-testid="descricao-da-acao">{def.descricao}</p>

        <div className="vei-form__linha">
          {def.comData && <Field label={rotuloDaData(acao)}><DateField value={data} onChange={(e) => setData(e.target.value)} /></Field>}
          {def.comChecklist && <Field label="Hora" error={hora.length === 5 && !horaOk ? "Hora inválida." : null}><Input inputMode="numeric" value={hora} onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setHora(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d); }} placeholder="14:30" maxLength={5} aria-label="Hora" /></Field>}
          {def.comChecklist && <Field label="Evento"><Select value={eventoSel} onChange={(e) => setEventoSel(e.target.value)} aria-label="Evento do checklist"><option value="">Achar pelo carro (reserva aberta)</option>{eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</Select></Field>}
          {acao === "reserva" && (
            <>
              <Field label="Evento"><Select value={eventoSel} onChange={(e) => setEventoSel(e.target.value)} placeholder="Escolher o evento…" aria-label="Evento da reserva"><option value="">Escolher o evento…</option>{eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}<option value="__novo__">＋ Criar um evento novo…</option></Select></Field>
              {eventoSel === "__novo__" && <Field label="Nome do novo evento (opcional)"><Input value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Em branco: EVENTO SEM DATA" maxLength={120} /></Field>}
            </>
          )}
        </div>
        {def.comChecklist && (
          <details className="mt-extra-checklist"><summary className="t-body-sm">Opcional: combustível, limpeza, quem recebeu e observações (valem para todos)</summary>
            <div className="vei-form__linha" style={{ marginTop: 8 }}>
              <Field label="Combustível / carga"><Select value={extra.combustivel} onChange={(e) => setExtra({ ...extra, combustivel: e.target.value })} aria-label="Combustível"><option value="">Não informado</option>{COMBUSTIVEIS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
              <Field label="Limpeza"><Select value={extra.limpeza} onChange={(e) => setExtra({ ...extra, limpeza: e.target.value })} aria-label="Limpeza"><option value="">Não informado</option>{LIMPEZAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
            </div>
            <div className="vei-form__linha">
              <Field label={acao === "saida" ? "Quem recebeu os carros" : "Quem recebeu de volta"}><Input value={extra.recebido} onChange={(e) => setExtra({ ...extra, recebido: e.target.value })} maxLength={120} /></Field>
              <Field label="Observações"><Input value={extra.obs} onChange={(e) => setExtra({ ...extra, obs: e.target.value })} /></Field>
            </div>
          </details>
        )}

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
          <Button size="lg" loading={enviando} disabled={!veiculos || cont.ok === 0 || cont.erro > 0 || (acao === "reserva" && eventoSel === "") || (!!def.comChecklist && !horaOk)} onClick={() => void aplicar()} data-testid="aplicar-em-massa">
            {acao === "reserva" ? `Reservar ${cont.ok} carro${cont.ok === 1 ? "" : "s"}` : def.comChecklist ? `Registrar o checklist de ${cont.ok} carro${cont.ok === 1 ? "" : "s"}` : `Atualizar ${cont.ok} veículo${cont.ok === 1 ? "" : "s"}`}
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
