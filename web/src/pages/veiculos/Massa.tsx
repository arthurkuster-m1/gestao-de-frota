import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { DataSheetGrid, keyColumn, textColumn } from "react-datasheet-grid";
import "react-datasheet-grid/dist/style.css";
import { ArrowLeft, CheckCircle, Columns, Plus, Trash, FileCsv, Minus, ArrowsClockwise, Warning, XCircle, ClipboardText } from "@phosphor-icons/react";
import { Painel } from "../../components/motor/Painel";
import { SeletorDeColunas } from "./SeletorDeColunas";
import { TituloArrastavel } from "./TituloArrastavel";
import { colunaOpcao } from "../lancamentos/colunaOpcao";
import { arrayMove } from "@dnd-kit/sortable";
import { SEGURO, CICLO } from "../../lib/veiculos/tipos";
import { SIM_NAO, type Opcao } from "../../lib/lancamentos/tipos";
import { Button, Page, Sheet, Textarea, useToast } from "../../ds";
import { criarVeiculos, listarVeiculos } from "../../lib/veiculos/dados";
import { CAMPOS, CAMPOS_PADRAO, analisarMatriz, chaveDoPedido, linhaVazia, validarTudo, type CampoLinha, type LinhaCrua, type Tom } from "../../lib/veiculos/importacao";
import "./veiculos.css";

type LinhaGrade = LinhaCrua & { __tom?: Tom; __texto?: string };
const semMeta = ({ __tom, __texto, ...resto }: LinhaGrade): LinhaCrua => { void __tom; void __texto; return resto; };
const ICONE: Record<Tom, React.ReactNode> = { erro: <XCircle size={15} weight="fill" />, ign: <Minus size={15} />, dup: <ArrowsClockwise size={15} />, ok: <CheckCircle size={15} weight="fill" /> };
const classeLinha = ({ rowData }: { rowData: LinhaGrade }) => (rowData.__tom ? `ds-massa__linha is-${rowData.__tom}` : undefined);
const vazias = (n: number): LinhaCrua[] => Array.from({ length: n }, () => ({}));

const COLUNA_SITUACAO = {
  id: "situacao", title: "Situação da linha", minWidth: 320, basis: 360, grow: 1, disabled: true,
  component: ({ rowData }: { rowData: LinhaGrade }) => (rowData.__tom && rowData.__tom !== "ign" ? <span className={`ds-massa__status is-${rowData.__tom}`} title={rowData.__texto}>{ICONE[rowData.__tom]}<span>{rowData.__texto}</span></span> : null),
  copyValue: ({ rowData }: { rowData: LinhaGrade }) => rowData.__texto ?? "",
  pasteValue: ({ rowData }: { rowData: LinhaGrade }) => rowData,
  deleteValue: ({ rowData }: { rowData: LinhaGrade }) => rowData,
  isCellEmpty: ({ rowData }: { rowData: LinhaGrade }) => !rowData.__tom,
};

/** Colunas de valor fixo: a célula vira uma caixa de seleção com as opções (as mesmas que a validação aceita). */
const OPCOES_DA_COLUNA: Partial<Record<CampoLinha, readonly Opcao[]>> = { blindado: SIM_NAO, seguro: SEGURO, ciclo: CICLO };
const CHAVE_COLUNAS = "frota:massa-veiculos:colunas";
type PrefsDeColunas = { ordem: CampoLinha[]; ligadas: CampoLinha[] };
const TODOS_OS_IDS = CAMPOS.map((c) => c.id);
const PADRAO: PrefsDeColunas = { ordem: [...CAMPOS_PADRAO, ...TODOS_OS_IDS.filter((i) => !CAMPOS_PADRAO.includes(i))], ligadas: [...CAMPOS_PADRAO] };
/** Colunas escolhidas (fica guardado neste navegador): coluna nova que passe a existir entra no fim, desligada. */
function lerColunas(): PrefsDeColunas {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE_COLUNAS) ?? "null") as PrefsDeColunas | null;
    if (p && Array.isArray(p.ordem) && Array.isArray(p.ligadas)) {
      const ordem = [...p.ordem.filter((i) => TODOS_OS_IDS.includes(i)), ...TODOS_OS_IDS.filter((i) => !p.ordem.includes(i))];
      const ligadas = p.ligadas.filter((i) => TODOS_OS_IDS.includes(i));
      if (ligadas.length) return { ordem, ligadas };
    }
  } catch { /* sem armazenamento */ }
  return PADRAO;
}

export function Massa() {
  const navigate = useNavigate();
  const toast = useToast();
  const [linhas, setLinhas] = useState<LinhaCrua[]>(() => vazias(8));
  const [selecionadas, setSelecionadas] = useState<{ de: number; ate: number } | null>(null);
  const grade = useRef<HTMLDivElement>(null);
  const excluirSelecionadas = () => { if (!selecionadas) return; const { de, ate } = selecionadas; setLinhas((l) => { const n = l.filter((_, k) => k < de || k > ate); return n.length ? n : vazias(1); }); setSelecionadas(null); };
  // Selecionando com o mouse até a borda da grade, ela rola sozinha (e a seleção acompanha).
  useEffect(() => {
    const el = grade.current; if (!el) return;
    const aoPressionar = (e: MouseEvent) => {
      const rolavel = el.querySelector<HTMLElement>(".dsg-container"); if (!rolavel || e.button !== 0) return;
      let x = e.clientX, y = e.clientY, quadro = 0;
      const mover = (ev: MouseEvent) => { x = ev.clientX; y = ev.clientY; };
      const passo = () => {
        const r = rolavel.getBoundingClientRect(); let dy = 0, dx = 0; const alt = window.innerHeight;
        if (y > alt - 60) dy = Math.min(36, (y - (alt - 60)) / 2 + 4); else if (y < 130) dy = -Math.min(36, (130 - y) / 2 + 4);
        if (x > r.right - 40) dx = Math.min(40, (x - (r.right - 40)) / 2 + 4); else if (x < r.left + 40) dx = -Math.min(40, (r.left + 40 - x) / 2 + 4);
        if (dy) window.scrollBy(0, dy);
        if (dx) rolavel.scrollBy(dx, 0);
        if (dx || dy) { document.dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true })); }
        quadro = requestAnimationFrame(passo);
      };
      const fim = () => { cancelAnimationFrame(quadro); window.removeEventListener("mousemove", mover); window.removeEventListener("mouseup", fim); };
      window.addEventListener("mousemove", mover); window.addEventListener("mouseup", fim); quadro = requestAnimationFrame(passo);
    };
    el.addEventListener("mousedown", aoPressionar);
    return () => el.removeEventListener("mousedown", aoPressionar);
  }, []);
  const [existentes, setExistentes] = useState<{ vins: Set<string>; placas: Set<string>; pedidos: Set<string> }>({ vins: new Set(), placas: new Set(), pedidos: new Set() });
  const [carregouBase, setCarregouBase] = useState(false);
  const [colando, setColando] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [prefs, setPrefs] = useState<PrefsDeColunas>(lerColunas);
  const mudaColunas = (p: PrefsDeColunas) => { setPrefs(p); try { localStorage.setItem(CHAVE_COLUNAS, JSON.stringify(p)); } catch { /* sem armazenamento */ } };
  const visiveis = useMemo(() => prefs.ordem.filter((i) => prefs.ligadas.includes(i)), [prefs]);

  useEffect(() => {
    listarVeiculos().then((l) => {
      setExistentes({ vins: new Set(l.map((v) => v.vin).filter((x): x is string => !!x)), placas: new Set(l.map((v) => v.placa).filter((x): x is string => !!x)), pedidos: new Set(l.map((v) => chaveDoPedido(v.pedido)).filter(Boolean)) });
      setCarregouBase(true);
    }, (e: Error) => setErro(`Não consegui conferir os veículos já cadastrados: ${e.message}`));
  }, []);

  const resultados = useMemo(() => validarTudo(linhas, existentes), [linhas, existentes]);
  const dados: LinhaGrade[] = useMemo(() => linhas.map((l, i) => ({ ...semMeta(l), __tom: resultados[i].tom, __texto: resultados[i].texto })), [linhas, resultados]);
  const cont = useMemo(() => { const c: Record<Tom, number> = { ok: 0, erro: 0, dup: 0, ign: 0 }; for (const r of resultados) c[r.tom]++; return c; }, [resultados]);

  /** Soltou o título de uma coluna sobre outra: a primeira vai para o lugar da segunda. */
  const prefsAgora = useRef(prefs); prefsAgora.current = prefs;
  const moverColuna = (de: string, para: string) => {
    const p = prefsAgora.current, a = p.ordem.indexOf(de as CampoLinha), b = p.ordem.indexOf(para as CampoLinha);
    if (a >= 0 && b >= 0) mudaColunas({ ...p, ordem: arrayMove([...p.ordem], a, b) });
  };
  // largura de cada coluna: arraste a borda do título (duplo clique volta ao padrão); fica guardada neste aparelho
  const [larguras, setLarguras] = useState<Record<string, number>>(() => { try { return JSON.parse(localStorage.getItem("frota:importacao-larguras") ?? "{}") as Record<string, number>; } catch { return {}; } });
  const redimensionar = (id: string, w: number | null) => setLarguras((l) => { const n = { ...l }; if (w === null) delete n[id]; else n[id] = w; try { localStorage.setItem("frota:importacao-larguras", JSON.stringify(n)); } catch { /* sem armazenamento */ } return n; });
  const colunas = useMemo(() => [
    ...visiveis.map((id) => CAMPOS.find((c) => c.id === id)!).map((c) => ({ ...keyColumn<LinhaGrade, CampoId>(c.id, (OPCOES_DA_COLUNA[c.id] ? colunaOpcao(OPCOES_DA_COLUNA[c.id]!) : textColumn) as never), title: <TituloArrastavel id={c.id} titulo={c.titulo} aoMover={moverColuna} largura={larguras[c.id] ?? c.largura} aoRedimensionar={redimensionar} />, minWidth: larguras[c.id] ?? c.largura, basis: larguras[c.id] ?? c.largura, grow: 0, shrink: 0 })),
    { ...COLUNA_SITUACAO, minWidth: 360, basis: 360, grow: 1 },   // a situação da linha fica por último
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [visiveis, larguras]);

  function adicionar(matriz: string[][]) {
    const { linhas: novas, campos: doCabecalho } = analisarMatriz(matriz, visiveis);
    if (novas.length === 0) { setErro("Não encontrei linhas nesse texto."); return; }
    setErro(null);
    const escondidas = doCabecalho.filter((c) => !prefs.ligadas.includes(c));   // a planilha trouxe colunas que estavam desligadas: liga para os dados aparecerem
    if (escondidas.length) { mudaColunas({ ...prefs, ligadas: [...prefs.ligadas, ...escondidas] }); toast(`Colunas ligadas: ${escondidas.map((c) => CAMPOS.find((x) => x.id === c)!.titulo).join(", ")}`); }
    setLinhas((atual) => { const base = atual.filter((l) => !linhaVazia(l)); return [...base, ...novas, ...vazias(3)]; });
  }
  async function arquivo(f: File | undefined) {
    if (!f) return;
    try { adicionar(Papa.parse<string[]>(await f.text(), { skipEmptyLines: true }).data); } catch { setErro("Não consegui ler esse arquivo. Use CSV ou TXT separado por vírgula, ponto e vírgula ou tab."); }
  }

  async function cadastrar() {
    const prontos = resultados.flatMap((r) => (r.tom === "ok" && r.veiculo ? [r.veiculo] : []));
    setEnviando(true); setErro(null);
    try { const n = await criarVeiculos(prontos); toast(`${n} veículo${n === 1 ? "" : "s"} cadastrado${n === 1 ? "" : "s"}`); navigate("/veiculos"); }
    catch (x) { setErro((x as Error).message + " Nada foi gravado."); } finally { setEnviando(false); }
  }

  return (
    <Page wide>
      <div className="ds-stack">
        <Link to="/veiculos" className="ds-row" style={{ textDecoration: "none" }}><ArrowLeft size={20} />Veículos</Link>
        <div>
          <h1 className="t-h1">Importar veículos em massa</h1>
          <p className="t-body t-muted">Cole a tabela do Excel direto na grade (Ctrl+V), ou use os botões. Só o <b>modelo</b> é obrigatório: um pedido novo pode ter só modelo, cor, MY e pedido.</p>
        </div>

        <div className="ds-row" style={{ flexWrap: "wrap" }}>
          <Button variant="secondary" icon={<ClipboardText size={20} />} onClick={() => setColando(true)}>Colar texto</Button>
          <label className="ds-btn ds-btn--secondary" style={{ cursor: "pointer" }}><FileCsv size={20} />Abrir CSV<input type="file" accept=".csv,.txt,.tsv" hidden onChange={(e) => { void arquivo(e.target.files?.[0]); e.target.value = ""; }} /></label>
          <Painel rotulo="Colunas" icone={<Columns size={18} />} contagem={visiveis.length} largura={340} testid="colunas-da-importacao">
            <SeletorDeColunas ordem={prefs.ordem} titulos={CAMPOS} ligadas={new Set(prefs.ligadas)} onChange={(ordem, ligadas) => mudaColunas({ ordem: ordem as CampoLinha[], ligadas: ordem.filter((i) => ligadas.has(i)) as CampoLinha[] })} onPadrao={() => mudaColunas(PADRAO)} />
          </Painel>
          <Button variant="secondary" icon={<Plus size={18} />} onClick={() => setLinhas((l) => [...l, ...vazias(1)])} data-testid="adicionar-linha">Linha</Button>
          <Button variant="secondary" icon={<Plus size={18} />} onClick={() => setLinhas((l) => [...l, ...vazias(10)])}>10 linhas</Button>
          <Button variant="secondary" icon={<Trash size={18} />} disabled={!selecionadas} onClick={excluirSelecionadas} data-testid="excluir-linhas">{selecionadas && selecionadas.ate > selecionadas.de ? `Excluir ${selecionadas.ate - selecionadas.de + 1} linhas` : "Excluir linha"}</Button>
          <Button variant="ghost" onClick={() => { setLinhas(vazias(8)); setSelecionadas(null); }}>Limpar</Button>
        </div>

        <div>
          <div className="ds-massa vei-massa" data-testid="grade-massa" ref={grade}>
            <DataSheetGrid<LinhaGrade> height={1000000} onSelectionChange={({ selection }) => setSelecionadas(selection ? { de: Math.min(selection.min.row, selection.max.row), ate: Math.max(selection.min.row, selection.max.row) } : null)} onActiveCellChange={({ cell }) => { if (!cell) setSelecionadas(null); else setSelecionadas((a) => a ?? { de: cell.row, ate: cell.row }); }} key={visiveis.join(",")} value={dados} onChange={(v) => setLinhas(v.map(semMeta))} columns={colunas} rowClassName={classeLinha} lockRows={false} gutterColumn={{ minWidth: 40 }} addRowsComponent={false} stickyRightColumn={undefined} createRow={() => ({})} duplicateRow={({ rowData }) => semMeta(rowData)} />
          </div>
        </div>

        <div className="ds-row" style={{ flexWrap: "wrap", justifyContent: "space-between" }} aria-live="polite" data-testid="resumo-massa">
          <span className="t-body">
            <b>{cont.ok}</b> pronto{cont.ok === 1 ? "" : "s"}{cont.dup > 0 && <> · <Warning size={16} style={{ verticalAlign: "-3px" }} /> {cont.dup} já cadastrado{cont.dup === 1 ? "" : "s"} (ignorado{cont.dup === 1 ? "" : "s"})</>}{cont.erro > 0 && <> · <b style={{ color: "var(--color-error-fg)" }}>{cont.erro} com erro</b></>}
          </span>
          <Button size="lg" loading={enviando} disabled={!carregouBase || cont.ok === 0 || cont.erro > 0} onClick={() => void cadastrar()}>
            Cadastrar {cont.ok} veículo{cont.ok === 1 ? "" : "s"}
          </Button>
        </div>
        {cont.erro > 0 && <p className="t-body-sm t-muted">Corrija ou apague as linhas com erro para liberar o botão. Ou tudo entra, ou nada entra.</p>}
        {erro && <p className="t-body" role="alert" style={{ color: "var(--color-error-fg)" }}>{erro}</p>}
      </div>

      <Sheet open={colando} onClose={() => setColando(false)} title="Colar do Excel">
        <div className="ds-stack">
          <p className="t-body-sm t-muted">Copie as células no Excel (com ou sem a linha de títulos) e cole aqui. Escreva a versão junto do modelo (Onix RS). Colunas aceitas: Modelo, Cor, MY, Pedido, VIN/Chassi, Placa, Blindado, Seguro, Ciclo de vida, Comentários e as datas (do pedido, liberação, faturamento, emplacamento, devolução, em dd/mm/aaaa). Sem títulos, vale a ordem das colunas da tabela.</p>
          <Textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto colado" />
          <Button size="lg" block disabled={!texto.trim()} onClick={() => { adicionar(Papa.parse<string[]>(texto, { delimiter: "\t", skipEmptyLines: true }).data); setTexto(""); setColando(false); }}>Adicionar à grade</Button>
        </div>
      </Sheet>
    </Page>
  );
}
type CampoId = (typeof CAMPOS)[number]["id"];
