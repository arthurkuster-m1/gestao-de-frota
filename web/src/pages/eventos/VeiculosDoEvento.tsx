import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Link } from "react-router-dom";
import { CaretLeft, CaretRight, ClipboardText, Columns, CopySimple, ListChecks, Lock, Plus, SortAscending, Trash, Warning, X } from "@phosphor-icons/react";
import { Button, Field, Segmented, Select, Sheet, Switch, cx, useToast } from "../../ds";
import { LinkNoLugar } from "../../app/noLugar";
import { Tag } from "../../components/motor/Tag";
import { CampoEditavel } from "../../components/motor/CampoEditavel";
import { Painel } from "../../components/motor/Painel";
import { prepararEdicao } from "../../components/motor/edicao";
import { converterColado, deTsv, intervaloDe, multiplas, paraTsv, type Ponto } from "../../components/motor/selecao";
import { ThOrdenavel } from "../../components/motor/ThOrdenavel";
import type { CampoDaTela } from "../../components/motor/tipos";
import { useEdicao } from "../../components/motor/useEdicao";
import { ORIGEM_PADRAO, validarEndereco } from "../../lib/enderecos";
import { formatarDiaBr, hojeLocal } from "../../lib/motor/datas";
import { codigoDaLinha, copiarTabela, custoDoEvento, montarLinhas, tabelaParaOutlook, valoresEfetivos, type LinhaDoEvento } from "../../lib/eventos/linhasDoEvento";
import type { Evento, EventoLocal, ModeloDesejado, Reserva, ReservaDoEvento } from "../../lib/eventos/tipos";
import { conflitos, reservasPorVeiculo, agendaTexto } from "../../lib/eventos/uso";
import { reais } from "../../lib/transportes/regras";
import { rotaDoTransporte } from "../../lib/transportes/rota";
import type { Sentido, Transporte } from "../../lib/transportes/tipos";
import type { Manutencao } from "../../lib/manutencoes/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";
import type { Checklist, ChecklistNovo, Momento } from "../../lib/checklists/tipos";
import { ChecklistEmMassaSheet, type DadosEmMassa } from "../checklists/ChecklistEmMassaSheet";
import { reservasSemChecklist } from "../../lib/checklists/regras";
import { ChecklistsDaReserva } from "../checklists/ChecklistsDaReserva";
import type { useTransportes } from "../transportes/useTransportes";
import { AdicionarVeiculos } from "./AdicionarVeiculos";
import { OPCOES_STATUS_EVENTO } from "./camposDoEvento";
import { TransporteDoCarroSheet } from "./TransporteDoCarroSheet";

type Tr = ReturnType<typeof useTransportes>;
type ColunaOpcional = "status" | "transporteIda" | "transporteVolta" | "origem" | "chegada" | "enderecoChegada" | "retirada" | "enderecoRetorno" | "comentarios";
const COLUNAS_OPCIONAIS: { id: ColunaOpcional; titulo: string }[] = [
  { id: "status", titulo: "Status do carro" }, { id: "transporteIda", titulo: "Transporte de ida" }, { id: "transporteVolta", titulo: "Transporte de volta" },
  { id: "origem", titulo: "Origem" }, { id: "chegada", titulo: "Data de chegada" }, { id: "enderecoChegada", titulo: "Endereço de chegada" }, { id: "retirada", titulo: "Data de retirada" },
  { id: "enderecoRetorno", titulo: "Endereço de retorno" }, { id: "comentarios", titulo: "Comentários" },
];
const INFO = [{ id: "placa", titulo: "Placa" }, { id: "vin", titulo: "VIN" }, { id: "modelo", titulo: "Modelo" }, { id: "cor", titulo: "Cor" }, { id: "my", titulo: "MY" }] as const;
const CAMPOS_EDITAVEIS: ColunaOpcional[] = ["status", "origem", "chegada", "enderecoChegada", "retirada", "enderecoRetorno", "comentarios"];
const CHAVE = "frota:evento-veiculos:v2";
/** `colunas` = as colunas ligadas, NA ORDEM em que aparecem (arrastar o título muda a ordem). `infoCols` = quais dados do veículo aparecem ao lado do código. `ordem`/`agrupar` = ordenar e agrupar as linhas. */
type Prefs = { infoCols: string[]; colunas: ColunaOpcional[]; ordem: { col: string; dir: "asc" | "desc" } | null; agrupar: string | null };
const TODAS_INFO = INFO.map((c) => c.id as string);
function lerPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as (Partial<Prefs> & { info?: boolean }) | null;
    if (p && Array.isArray(p.colunas)) return {
      infoCols: Array.isArray(p.infoCols) ? p.infoCols.filter((c) => TODAS_INFO.includes(c)) : p.info ? TODAS_INFO : [],
      colunas: p.colunas.filter((c) => COLUNAS_OPCIONAIS.some((o) => o.id === c)),
      ordem: p.ordem && typeof p.ordem.col === "string" ? { col: p.ordem.col, dir: p.ordem.dir === "desc" ? "desc" : "asc" } : null,
      agrupar: typeof p.agrupar === "string" ? p.agrupar : null,
    };
  } catch { /* sem armazenamento */ }
  return { infoCols: [], colunas: [], ordem: null, agrupar: null };
}
function gravarPrefs(p: Prefs) { try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch { /* sem armazenamento */ } }
const COLUNAS_DE_ORDEM = [{ id: "codigo", titulo: "Código" }, ...INFO, ...COLUNAS_OPCIONAIS] as { id: string; titulo: string }[];

type Props = {
  evento: Evento; veiculos: Veiculo[]; reservas: Reserva[]; /** carros no evento ainda sem data */ reservasSemData?: ReservaDoEvento[]; onReservarSemData?: (eventoId: string, veiculoIds: string[], pedidoId?: string) => Promise<void>; eventos: Evento[]; locais: EventoLocal[]; desejados: ModeloDesejado[]; manutencoes?: Manutencao[]; tr: Tr;
  checklists?: Checklist[]; onSalvarChecklist?: (reservaId: string, momento: Momento, existente: Checklist | null, dados: Omit<ChecklistNovo, "reserva_id" | "momento">) => Promise<void>;
  onSalvarReserva: (id: string, patch: Partial<Pick<Reserva, "chegada" | "retirada" | "origem" | "endereco_chegada" | "endereco_retorno" | "comentarios" | "status_individual" | "reserva_inicio" | "reserva_fim">>) => Promise<void>;
  onReservar: (eventoId: string, veiculoIds: string[], inicio: string, fim: string, janela: { chegada: string; retirada: string }, pedidoId?: string) => Promise<void>;
  onRemoverReserva: (r: { id: string }) => Promise<void>; onNaoAtendido: (id: string, naoAtendido: boolean) => Promise<void>; onErro: (m: string) => void;
  /** Checklist (envio) do mesmo jeito para vários carros: ids das reservas e os dados comuns. */
  onChecklistEmMassa?: (reservaIds: string[], dados: DadosEmMassa) => Promise<void>;
};

/**
 * Os carros do evento numa tabela só. Padrão: "Definido" e "Código" (setinha: Placa/VIN/Modelo/Cor/MY; prancheta: copia para o Outlook).
 * Eventos grandes: colunas individuais (status, transportes, origem, chegada, endereço, retirada) que herdam do evento. Dá para
 * arrastar o título para mudar a ordem, selecionar células (arrastando), copiar, colar, duplicar para baixo e marcar vários carros
 * para aplicar o MESMO transporte de uma vez.
 */
export function VeiculosDoEvento({ evento, veiculos, reservas, reservasSemData = [], onReservarSemData, eventos, locais, desejados, manutencoes, tr, checklists = [], onSalvarChecklist, onSalvarReserva, onReservar, onRemoverReserva, onNaoAtendido, onErro, onChecklistEmMassa }: Props) {
  const toast = useToast();
  const [prefs, setPrefs] = useState<Prefs>(lerPrefs);
  const muda = (p: Prefs) => { setPrefs(p); gravarPrefs(p); };
  const [individual, setIndividual] = useState(false);
  const [escolhendo, setEscolhendo] = useState<{ pedido: ModeloDesejado | null } | null>(null);
  const [transporte, setTransporte] = useState<{ reservaIds: string[]; sentido: Sentido; rotulo: string; atual: Transporte | null } | null>(null);
  const [checklist, setChecklist] = useState<LinhaDoEvento | null>(null);
  const [loteDeChecklist, setLoteDeChecklist] = useState<LinhaDoEvento[] | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());          // carros marcados (caixinha) para ações em massa
  const [sel, setSel] = useState<{ a: Ponto; b: Ponto } | null>(null);      // bloco de células selecionado
  const arrastandoSel = useRef(false);

  const pedidosDoEvento = useMemo(() => desejados.filter((p) => p.evento_id === evento.id), [desejados, evento.id]);
  const locaisDoEvento = useMemo(() => locais.filter((l) => l.evento_id === evento.id), [locais, evento.id]);
  const linhas = useMemo(() => montarLinhas(evento.id, [...reservas, ...reservasSemData], pedidosDoEvento, veiculos), [evento.id, reservas, reservasSemData, pedidosDoEvento, veiculos]);
  const porCarro = useMemo(() => reservasPorVeiculo(reservas), [reservas]);
  const nomes = useMemo(() => new Map(eventos.map((e) => [e.id, e.nome])), [eventos]);
  const transporteDe = (l: LinhaDoEvento, s: Sentido): Transporte | null => {
    const v = l.reserva && tr.vinculos.find((x) => x.id === l.reserva!.id); const id = v ? (s === "ida" ? v.transporte_ida_id : v.transporte_volta_id) : null;
    return id ? (tr.transportes.find((t) => t.id === id) ?? null) : null;
  };
  const custo = custoDoEvento(tr.transportes, evento.id);
  const ordenadas = prefs.colunas;                                           // colunas opcionais ligadas, em ordem
  const colunasInfo = INFO.map((c) => c.id as string).filter((c) => prefs.infoCols.includes(c));
  /** Colunas selecionáveis (por células), na ordem em que aparecem. */
  const colunasSel = useMemo(() => [...colunasInfo, ...ordenadas] as string[], [colunasInfo.join(","), ordenadas.join(",")]);  // eslint-disable-line react-hooks/exhaustive-deps
  const tituloDe = (id: string) => INFO.find((c) => c.id === id)?.titulo ?? COLUNAS_OPCIONAIS.find((c) => c.id === id)?.titulo ?? id;

  // edição individual: só com o interruptor ligado (clicar numa célula herdada liga e já abre o editor)
  const [pendente, setPendente] = useState<{ l: LinhaDoEvento; id: string } | null>(null);
  const ed = useEdicao<LinhaDoEvento>((l) => l.key, individual ? async (l, campo, valor) => {
    if (!l.reserva) throw new Error("Defina o veículo desta linha primeiro.");
    await onSalvarReserva(l.reserva.id, { [campo.edicao!.coluna]: valor } as never);
  } : undefined);

  const campo = (id: string, titulo: string, tipo: "texto" | "data" | "opcao", coluna: string, valorDe: (l: LinhaDoEvento) => { valor: string | null; herdado: boolean }): CampoDaTela<LinhaDoEvento> => ({
    id, titulo, tipo, largura: 160, edicao: coluna === "origem" || coluna === "endereco_chegada" || coluna === "endereco_retorno" ? { coluna, endereco: true, validar: validarEndereco, ...(coluna === "origem" ? { sugestaoDeEndereco: ORIGEM_PADRAO } : {}) } : coluna === "comentarios" ? { coluna, maxLength: 2000 } : { coluna }, valorDe: (l) => valorDe(l).valor, ...(tipo === "opcao" ? { opcoes: OPCOES_STATUS_EVENTO } : {}),
    celula: (l) => { const { valor, herdado } = valorDe(l); const txt = !valor ? "—" : tipo === "data" ? formatarDiaBr(valor) : tipo === "opcao" ? <Tag opcao={OPCOES_STATUS_EVENTO.find((o) => o.value === valor) ?? { value: valor, label: valor }} campoId="status" /> : valor;
      return <span className={cx(herdado && "mt-herdado")} title={herdado && valor ? "Vem do evento" : undefined}>{txt}</span>; },
  });
  const campos = useMemo(() => ({
    status: campo("status", "Status do carro", "opcao", "status_individual", (l) => valoresEfetivos(l, evento, locaisDoEvento).status),
    origem: campo("origem", "Origem", "texto", "origem", (l) => valoresEfetivos(l, evento, locaisDoEvento).origem),
    chegada: campo("chegada", "Data de chegada", "data", "chegada", (l) => valoresEfetivos(l, evento, locaisDoEvento).chegada),
    enderecoChegada: campo("enderecoChegada", "Endereço de chegada", "texto", "endereco_chegada", (l) => valoresEfetivos(l, evento, locaisDoEvento).enderecoChegada),
    retirada: campo("retirada", "Data de retirada", "data", "retirada", (l) => valoresEfetivos(l, evento, locaisDoEvento).retirada),
    enderecoRetorno: campo("enderecoRetorno", "Endereço de retorno", "texto", "endereco_retorno", (l) => valoresEfetivos(l, evento, locaisDoEvento).enderecoRetorno),
    comentarios: campo("comentarios", "Comentários", "texto", "comentarios", (l) => ({ valor: l.reserva?.comentarios ?? null, herdado: false })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [evento, locaisDoEvento]);
  const navegaveis = Object.keys(campos);
  useEffect(() => { if (individual && pendente) { ed.abrir(pendente.l, campos[pendente.id as keyof typeof campos]); setPendente(null); } }, [individual, pendente]);   // eslint-disable-line react-hooks/exhaustive-deps

  const resumoTexto = (t: Transporte | null) => (t ? [t.modalidade === "pta" ? "PTA" : t.modalidade === "tso" ? "TSO" : "Retirada", t.referencia, t.transportadora, t.valor_planejado != null ? reais(t.valor_planejado) : null].filter(Boolean).join(" · ") : "");
  /** O texto de uma célula como aparece (é o que vai para a área de transferência). */
  const textoDaCelula = (colId: string, l: LinhaDoEvento): string => {
    const v = l.veiculo; const ef = valoresEfetivos(l, evento, locaisDoEvento);
    switch (colId) {
      case "placa": return v?.placa ?? ""; case "vin": return v?.vin ?? ""; case "modelo": return v?.modelo ?? ""; case "cor": return v?.cor ?? ""; case "my": return v?.my ?? "";
      case "status": return OPCOES_STATUS_EVENTO.find((o) => o.value === ef.status.valor)?.label ?? ef.status.valor ?? "";
      case "codigo": return codigoDaLinha(l);
      case "origem": return ef.origem.valor ?? ""; case "enderecoChegada": return ef.enderecoChegada.valor ?? "";
      case "enderecoRetorno": return ef.enderecoRetorno.valor ?? ""; case "comentarios": return l.reserva?.comentarios ?? "";
      case "chegada": return ef.chegada.valor ? formatarDiaBr(ef.chegada.valor) : ""; case "retirada": return ef.retirada.valor ? formatarDiaBr(ef.retirada.valor) : "";
      case "transporteIda": return resumoTexto(transporteDe(l, "ida")); case "transporteVolta": return resumoTexto(transporteDe(l, "volta"));
      default: return "";
    }
  };

  /** As linhas na ordem em que aparecem: agrupadas e/ou ordenadas conforme as preferências (a seleção de células segue ESTA ordem). */
  const chaveDeOrdem = (colId: string, l: LinhaDoEvento): string => {
    const ef = valoresEfetivos(l, evento, locaisDoEvento);
    if (colId === "chegada") return ef.chegada.valor ?? ""; if (colId === "retirada") return ef.retirada.valor ?? "";
    return textoDaCelula(colId, l);
  };
  const rotuloDoGrupo = (colId: string, l: LinhaDoEvento) => textoDaCelula(colId, l).trim() || "(vazio)";
  const visiveis = useMemo(() => {
    const { ordem, agrupar } = prefs;
    if (!ordem && !agrupar) return linhas;
    const cmp = (a: string, b: string) => (a === "" ? (b === "" ? 0 : 1) : b === "" ? -1 : a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));   // vazios sempre por último
    return [...linhas].sort((a, b) => {
      if (agrupar) { const g = cmp(rotuloDoGrupo(agrupar, a) === "(vazio)" ? "" : rotuloDoGrupo(agrupar, a), rotuloDoGrupo(agrupar, b) === "(vazio)" ? "" : rotuloDoGrupo(agrupar, b)); if (g) return g; }
      if (ordem) { const c = cmp(chaveDeOrdem(ordem.col, a), chaveDeOrdem(ordem.col, b)); return ordem.dir === "desc" && chaveDeOrdem(ordem.col, a) !== "" && chaveDeOrdem(ordem.col, b) !== "" ? -c : c; }
      return 0;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, prefs.ordem, prefs.agrupar, evento, locaisDoEvento, tr.transportes, tr.vinculos]);
  const tamanhoDoGrupo = useMemo(() => { const m = new Map<string, number>(); if (prefs.agrupar) for (const l of visiveis) { const k = rotuloDoGrupo(prefs.agrupar, l); m.set(k, (m.get(k) ?? 0) + 1); } return m; }, [visiveis, prefs.agrupar]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function copiarOutlook() {
    const t = tabelaParaOutlook(linhas);
    if (!linhas.some((l) => l.veiculo)) { toast("Nenhum carro definido para copiar"); return; }
    if (await copiarTabela(t)) toast("Tabela copiada: cole no Outlook"); else onErro("Não consegui copiar. Libere a área de transferência no navegador.");
  }

  // ---- seleção de células: copiar, colar e duplicar para baixo
  const faixa = sel ? intervaloDe(sel.a, sel.b) : null;
  const copiaInterna = useRef<{ tsv: string; ids: (string | null | undefined)[][] } | null>(null);   // o que a última cópia levou além do texto: o transporte de cada célula
  const idDoTransporte = (colId: string, l: LinhaDoEvento): string | null | undefined => (colId === "transporteIda" || colId === "transporteVolta" ? (transporteDe(l, colId === "transporteIda" ? "ida" : "volta")?.id ?? null) : undefined);
  const ref = useRef({ faixa, linhas: visiveis, colunasSel, texto: textoDaCelula, idDoTransporte });
  ref.current = { faixa, linhas: visiveis, colunasSel, texto: textoDaCelula, idDoTransporte };   // os ouvintes do documento leem sempre o estado de agora
  const fazer = useRef<{ colar: (m: string[][]) => void; duplicar: () => void }>({ colar: () => undefined, duplicar: () => undefined });
  fazer.current = {
    colar: (m) => void (async () => {
      const { faixa: f, linhas: ls, colunasSel: cs } = ref.current; if (!f) return;
      if (!individual) setIndividual(true);
      const encher = m.length === 1 && m[0]!.length === 1 && multiplas(f);
      const nl = encher ? f.l1 - f.l0 + 1 : m.length; let ok = 0, pulados = 0, erro: string | null = null;
      // colando o que ACABOU de ser copiado daqui: as células de transporte levam o próprio transporte (não só o texto)
      const interna = copiaInterna.current && copiaInterna.current.tsv === paraTsv(m) ? copiaInterna.current : null;
      const lotes = new Map<string, { sentido: Sentido; id: string | null; reservas: string[] }>();
      for (let dr = 0; dr < nl; dr++) {
        const l = ls[f.l0 + dr]; if (!l) break; const linhaM = encher ? m[0]! : m[dr]!; const nc = encher ? f.c1 - f.c0 + 1 : linhaM.length;
        for (let dc = 0; dc < nc; dc++) {
          const colId = cs[f.c0 + dc];
          if ((colId === "transporteIda" || colId === "transporteVolta") && interna && l.reserva) {
            const sentido: Sentido = colId === "transporteIda" ? "ida" : "volta";
            const idOrigem = interna.ids[encher ? 0 : dr]?.[encher ? 0 : dc];
            const dele = idOrigem ? tr.transportes.find((t) => t.id === idOrigem) : null;
            if (idOrigem === undefined || (dele && dele.sentido !== sentido)) { pulados++; continue; }   // outra coluna ou outro sentido (ida não vira volta)
            const k = `${sentido}|${idOrigem ?? ""}`; const lote = lotes.get(k) ?? { sentido, id: idOrigem, reservas: [] }; lote.reservas.push(l.reserva.id); lotes.set(k, lote); ok++; continue;
          }
          const cp = colId && (CAMPOS_EDITAVEIS as string[]).includes(colId) ? campos[colId as keyof typeof campos] : null;
          if (!cp || !l.reserva) { pulados++; continue; }
          const bruto = converterColado(cp, encher ? m[0]![0]! : linhaM[dc]!);
          if (bruto === undefined) { pulados++; continue; }
          const prep = prepararEdicao(cp.tipo, cp.edicao!, bruto);
          if (!prep.ok) { pulados++; erro ??= `${cp.titulo}: ${prep.erro}`; continue; }
          try { await onSalvarReserva(l.reserva.id, { [cp.edicao!.coluna]: prep.valor } as never); ok++; } catch (x) { pulados++; erro ??= `${cp.titulo}: ${(x as Error).message}`; }
        }
      }
      try { for (const lote of lotes.values()) await tr.ligarCarros(lote.reservas, lote.sentido, lote.id); } catch (x) { erro ??= (x as Error).message; }
      if (erro) onErro(erro);
      toast(pulados ? `${ok} colada(s), ${pulados} ignorada(s)` : `${ok} célula(s) coladas`);
    })(),
    duplicar: () => void (async () => {
      const { faixa: f, linhas: ls, colunasSel: cs } = ref.current; if (!f || f.l0 === f.l1) { toast("Selecione mais de uma linha para duplicar para baixo"); return; }
      const origem = ls[f.l0]!; const destinos = ls.slice(f.l0 + 1, f.l1 + 1).filter((l) => l.reserva); let n = 0;
      if (!individual) setIndividual(true);
      try {
        for (let c = f.c0; c <= f.c1; c++) {
          const colId = cs[c]; if (!colId) continue;
          if (colId === "transporteIda" || colId === "transporteVolta") {
            const s: Sentido = colId === "transporteIda" ? "ida" : "volta"; const t = transporteDe(origem, s);
            if (destinos.length) { await tr.ligarCarros(destinos.map((l) => l.reserva!.id), s, t?.id ?? null); n += destinos.length; }
          } else if ((CAMPOS_EDITAVEIS as string[]).includes(colId)) {
            const cp = campos[colId as keyof typeof campos]; const valor = cp.valorDe(origem);
            for (const l of destinos) { await onSalvarReserva(l.reserva!.id, { [cp.edicao!.coluna]: (valor ?? null) } as never); n++; }
          }
        }
        toast(`${n} célula(s) preenchidas para baixo`);
      } catch (x) { onErro((x as Error).message); }
    })(),
  };
  useEffect(() => {
    const solta = () => { arrastandoSel.current = false; };
    const fora = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.(".mt-vde__tabela")) setSel(null); };
    const copiar = (e: ClipboardEvent) => {
      const { faixa: f, linhas: ls, colunasSel: cs, texto, idDoTransporte } = ref.current;
      if (!f || (!multiplas(f) && window.getSelection()?.toString())) return;
      const m: string[][] = []; const ids: (string | null | undefined)[][] = [];
      for (let r = f.l0; r <= f.l1; r++) { const l = ls[r]; if (l) { m.push(cs.slice(f.c0, f.c1 + 1).map((c) => texto(c, l))); ids.push(cs.slice(f.c0, f.c1 + 1).map((c) => idDoTransporte(c, l))); } }
      copiaInterna.current = { tsv: paraTsv(m), ids };
      e.clipboardData?.setData("text/plain", paraTsv(m)); e.preventDefault();
      toast(multiplas(f) ? `${m.length * (f.c1 - f.c0 + 1)} células copiadas` : "Célula copiada");
    };
    const colar = (e: ClipboardEvent) => {
      if (!ref.current.faixa || (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
      const texto = e.clipboardData?.getData("text/plain"); if (!texto) return;
      e.preventDefault(); fazer.current.colar(deTsv(texto));
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSel(null);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && ref.current.faixa && !(e.target as HTMLElement | null)?.closest("input, textarea, select")) { e.preventDefault(); fazer.current.duplicar(); }
    };
    window.addEventListener("mouseup", solta); document.addEventListener("mousedown", fora); document.addEventListener("keydown", tecla);
    document.addEventListener("copy", copiar); document.addEventListener("paste", colar);
    return () => { window.removeEventListener("mouseup", solta); document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla); document.removeEventListener("copy", copiar); document.removeEventListener("paste", colar); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  /** `td` de dados: seleciona arrastando; bordas do bloco; conteúdo editável (ou read-only até ligar a edição individual). */
  const celula = (l: LinhaDoEvento, li: number, colId: string, conteudo: ReactNode) => {
    const ci = colunasSel.indexOf(colId);
    const dentro = !!faixa && multiplas(faixa) && li >= faixa.l0 && li <= faixa.l1 && ci >= faixa.c0 && ci <= faixa.c1;
    const bordas = dentro && faixa ? cx("mt-sel", li === faixa.l0 && "mt-sel-t", li === faixa.l1 && "mt-sel-b", ci === faixa.c0 && "mt-sel-l", ci === faixa.c1 && "mt-sel-r") : "";
    return (
      <td key={colId} className={bordas} onMouseDown={(e) => { if (e.button !== 0 || (e.target as HTMLElement).closest("button, input, a, select, textarea")) return; const p = { l: li, c: ci }; if (e.shiftKey && sel) { e.preventDefault(); setSel({ a: sel.a, b: p }); } else setSel({ a: p, b: p }); arrastandoSel.current = true; }}
        onMouseEnter={() => { if (arrastandoSel.current) setSel((v) => (v ? { a: v.a, b: { l: li, c: ci } } : v)); }}>{conteudo}</td>
    );
  };
  const editavel = (l: LinhaDoEvento, id: keyof typeof campos): ReactNode => {
    const c = campos[id];
    if (!l.reserva) return <span className="mt-valor">{c.celula?.(l)}</span>;
    if (individual) return <CampoEditavel linha={l} campo={c} ed={ed} navegaveis={navegaveis} />;
    return <button type="button" className="mt-valor mt-valor--edita" title="Clique para editar este carro (liga a Edição individual)" onClick={() => { setIndividual(true); setPendente({ l, id }); toast("Edição individual ligada"); }}>{c.celula?.(l)}</button>;
  };
  const botaoTransporte = (l: LinhaDoEvento, s: Sentido): ReactNode => {
    const t = transporteDe(l, s);
    const m = t ? (t.modalidade === "pta" ? "PTA" : t.modalidade === "tso" ? "TSO" : "Retirada") : null;
    return (
      <button type="button" className="mt-valor mt-valor--edita" disabled={!l.reserva} onClick={() => l.reserva && setTransporte({ reservaIds: [l.reserva.id], sentido: s, rotulo: codigoDaLinha(l), atual: t })}>
        {t ? <span className="mt-transp"><b>{m}</b>{t.referencia ? ` ${t.referencia}` : ""}{t.transportadora ? ` · ${t.transportadora}` : ""}{t.valor_planejado != null ? ` · ${reais(t.valor_planejado)}` : ""}</span> : <span className="mt-vazio">{l.reserva ? "＋ Definir" : "—"}</span>}
      </button>
    );
  };

  // ---- ordem das colunas (arrastando o título) e seleção em massa
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const aoSoltarColuna = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const de = ordenadas.indexOf(e.active.id as ColunaOpcional), para = ordenadas.indexOf(e.over.id as ColunaOpcional);
    if (de >= 0 && para >= 0) muda({ ...prefs, colunas: arrayMove(ordenadas, de, para) });
  };
  const semData = linhas.filter((l) => l.reserva && !l.reserva.reserva_inicio);
  async function aplicarDatasDoEvento() {
    const c = evento.chegada_prevista, t = evento.retirada_prevista; if (!c || !t) return;
    try { for (const l of semData) await onSalvarReserva(l.reserva!.id, { reserva_inicio: c, reserva_fim: t, chegada: l.reserva!.chegada ?? c, retirada: l.reserva!.retirada ?? t }); toast(`${semData.length} carro${semData.length === 1 ? "" : "s"} com as datas do evento`); }
    catch (e) { onErro((e as Error).message); }
  }
  const definidas = linhas.filter((l) => l.reserva);
  const todosMarcados = definidas.length > 0 && definidas.every((l) => marcados.has(l.key));
  const alternar = (k: string) => setMarcados((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const marcadas = definidas.filter((l) => marcados.has(l.key));
  const emMassa = (s: Sentido) => { const ids = marcadas.map((l) => l.reserva!.id); const primeiro = transporteDe(marcadas[0]!, s); setTransporte({ reservaIds: ids, sentido: s, rotulo: `${ids.length} carros`, atual: marcadas.every((l) => transporteDe(l, s)?.id === primeiro?.id) ? primeiro : null }); };

  const semSaida = new Set(reservasSemChecklist(definidas.map((l) => l.reserva!), checklists, "saida"));
  const linhasSemSaida = definidas.filter((l) => semSaida.has(l.reserva!.id));
  const definidos = definidas.length;
  const pedidoAlvo = escolhendo?.pedido ?? null;
  const nCols = 3 + colunasInfo.length + ordenadas.length;

  return (
    <div className="mt-vde" data-testid="veiculos-do-evento">
      <div className="mt-vde__barra">
        <div className="mt-vde__titulo"><h3 className="t-h3">Carros</h3><span className="mt-vde__contagem" title="Carros já escolhidos / pedidos ainda sem carro">{definidos} definido{definidos === 1 ? "" : "s"}{linhas.length - definidos > 0 ? ` · ${linhas.length - definidos} a definir` : ""}</span></div>
        <div className="mt-vde__ferramentas">
          <span title="Liga a edição de status, transporte, origem, datas e endereço de cada carro"><Switch checked={individual} onChange={setIndividual} label="Edição individual" /></span>
          <Painel rotulo="Colunas" icone={<Columns size={18} />} contagem={ordenadas.length} largura={280} testid="colunas-do-evento">
            <div className="mt-painel__corpo">
              <p className="t-body-sm t-muted">Dados do veículo</p>
              {INFO.map((c) => <label key={c.id} className="mt-notion__linha"><input type="checkbox" checked={prefs.infoCols.includes(c.id)} onChange={() => muda({ ...prefs, infoCols: prefs.infoCols.includes(c.id) ? prefs.infoCols.filter((x) => x !== c.id) : [...prefs.infoCols, c.id] })} />{c.titulo}</label>)}
              <p className="t-body-sm t-muted">Dados do carro neste evento</p>
              {COLUNAS_OPCIONAIS.map((c) => <label key={c.id} className="mt-notion__linha"><input type="checkbox" checked={ordenadas.includes(c.id)} onChange={() => muda({ ...prefs, colunas: ordenadas.includes(c.id) ? ordenadas.filter((x) => x !== c.id) : [...ordenadas, c.id] })} />{c.titulo}</label>)}
              <p className="t-body-sm t-muted">Arraste o título da coluna na tabela para mudar a ordem.</p>
            </div>
          </Painel>
          <Painel rotulo="Ordenar e agrupar" icone={<SortAscending size={18} />} contagem={(prefs.ordem ? 1 : 0) + (prefs.agrupar ? 1 : 0)} largura={300} testid="ordenar-agrupar-evento">
            <div className="mt-painel__corpo">
              <Field label="Ordenar por"><Select value={prefs.ordem?.col ?? ""} onChange={(e) => muda({ ...prefs, ordem: e.target.value ? { col: e.target.value, dir: prefs.ordem?.dir ?? "asc" } : null })} placeholder="Sem ordem"><option value="">Sem ordem</option>{COLUNAS_DE_ORDEM.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}</Select></Field>
              {prefs.ordem && <Segmented block options={[{ value: "asc", label: "A → Z" }, { value: "desc", label: "Z → A" }]} value={prefs.ordem.dir} onChange={(v: "asc" | "desc") => muda({ ...prefs, ordem: prefs.ordem ? { ...prefs.ordem, dir: v } : null })} />}
              <Field label="Agrupar por"><Select value={prefs.agrupar ?? ""} onChange={(e) => muda({ ...prefs, agrupar: e.target.value || null })} placeholder="Sem grupos"><option value="">Sem grupos</option>{COLUNAS_DE_ORDEM.filter((c) => c.id !== "codigo").map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}</Select></Field>
              {(prefs.ordem || prefs.agrupar) && <Button size="sm" variant="ghost" onClick={() => muda({ ...prefs, ordem: null, agrupar: null })}>Limpar ordem e grupos</Button>}
            </div>
          </Painel>
          {onChecklistEmMassa && linhasSemSaida.length > 0 && <Button size="sm" variant="secondary" icon={<ListChecks size={16} />} onClick={() => setLoteDeChecklist(linhasSemSaida)} data-testid="checklist-de-todos" title="Checklist de envio de todos os carros que ainda não têm">Checklist<span className="mt-so-pc"> de envio</span> ({linhasSemSaida.length})</Button>}
          <Button size="sm" icon={<Plus size={16} />} onClick={() => setEscolhendo({ pedido: null })} data-testid="adicionar-carros">Reservar<span className="mt-so-pc"> carros</span></Button>
        </div>
      </div>

      {semData.length > 0 && (
        <div className="mt-vde__massa" role="status" data-testid="aviso-sem-data">
          <b>{semData.length} carro{semData.length === 1 ? "" : "s"} sem data</b>
          {evento.chegada_prevista && evento.retirada_prevista
            ? <Button size="sm" onClick={() => void aplicarDatasDoEvento()} data-testid="aplicar-datas-do-evento">Aplicar as datas do evento ({formatarDiaBr(evento.chegada_prevista)} a {formatarDiaBr(evento.retirada_prevista)})</Button>
            : <span className="t-body-sm t-muted">Defina a data de chegada e de retirada do evento (aba Dados) ou ligue a Edição individual e preencha as datas de cada carro.</span>}
        </div>
      )}
      {(marcadas.length > 0 || (faixa && multiplas(faixa))) && (
        <div className="mt-vde__massa" role="toolbar" aria-label="Ações em massa" data-testid="barra-em-massa">
          {marcadas.length > 0 && <>
            <b>{marcadas.length} carro{marcadas.length === 1 ? "" : "s"} marcado{marcadas.length === 1 ? "" : "s"}</b>
            <Button size="sm" variant="secondary" onClick={() => emMassa("ida")} data-testid="massa-ida">Transporte de ida…</Button>
            <Button size="sm" variant="secondary" onClick={() => emMassa("volta")} data-testid="massa-volta">Transporte de volta…</Button>
            {onChecklistEmMassa && marcadas.some((l) => semSaida.has(l.reserva!.id)) && <Button size="sm" variant="secondary" icon={<ListChecks size={14} />} onClick={() => setLoteDeChecklist(marcadas.filter((l) => semSaida.has(l.reserva!.id)))} data-testid="massa-checklist">Checklist de envio…</Button>}
            <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => setMarcados(new Set())}>Limpar</Button>
          </>}
          {faixa && multiplas(faixa) && <Button size="sm" variant="secondary" icon={<CopySimple size={16} />} onClick={() => fazer.current.duplicar()} data-testid="duplicar-para-baixo" title="Ctrl + D">Duplicar para baixo</Button>}
        </div>
      )}

      <div className="mt-vde__rolar">
        <table className="mt-vde__tabela">
          <thead>
            <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltarColuna}>
              <SortableContext items={ordenadas} strategy={horizontalListSortingStrategy}>
                <tr>
                  <th className="mt-vde__sel"><input type="checkbox" checked={todosMarcados} onChange={() => setMarcados(todosMarcados ? new Set() : new Set(definidas.map((l) => l.key)))} aria-label="Marcar todos os carros" disabled={definidas.length === 0} data-testid="marcar-todos" /></th>
                  <th><span className="mt-vde__cod">Código
                    <button type="button" className="mt-btn mt-btn--icone" aria-label={prefs.infoCols.length ? "Esconder placa, VIN, modelo, cor e MY" : "Mostrar placa, VIN, modelo, cor e MY"} aria-expanded={prefs.infoCols.length > 0} onClick={() => muda({ ...prefs, infoCols: prefs.infoCols.length ? [] : TODAS_INFO })} data-testid="toggle-info">{prefs.infoCols.length ? <CaretLeft size={16} weight="bold" /> : <CaretRight size={16} weight="bold" />}</button>
                    <button type="button" className="mt-btn mt-btn--icone" aria-label="Copiar tabela para o Outlook" title="Copiar para o Outlook" onClick={() => void copiarOutlook()} data-testid="copiar-outlook"><ClipboardText size={16} /></button></span></th>
                  {colunasInfo.map((c) => <th key={c}>{tituloDe(c)}</th>)}
                  {ordenadas.map((c) => <ThOrdenavel key={c} id={c} travada={false}>{tituloDe(c)}</ThOrdenavel>)}
                  <th className="mt-vde__acoes" aria-label="Ações" />
                </tr>
              </SortableContext>
            </DndContext>
          </thead>
          <tbody>
            {visiveis.length === 0 && <tr><td colSpan={nCols} className="t-body t-muted" style={{ padding: 16 }}>Nenhum carro ainda. Peça modelos no cadastro do evento ou reserve carros.</td></tr>}
            {visiveis.map((l, li) => {
              const v = l.veiculo; const r = l.reserva;
              const grupo = prefs.agrupar ? rotuloDoGrupo(prefs.agrupar, l) : null;
              const novoGrupo = grupo !== null && (li === 0 || rotuloDoGrupo(prefs.agrupar!, visiveis[li - 1]!) !== grupo);
              const indisponivel = !r && !!l.pedido?.nao_atendido;
              const choques = r && v && r.reserva_inicio && r.reserva_fim ? conflitos({ inicio: r.reserva_inicio, fim: r.reserva_fim }, porCarro.get(r.veiculo_id) ?? [], evento.id) : [];
              return (
                <Fragment key={l.key}>
                {novoGrupo && <tr className="mt-vde__grupo" data-testid="grupo-carros"><td colSpan={nCols}><b>{grupo}</b> <span className="t-muted">· {tamanhoDoGrupo.get(grupo!) ?? 0}</span></td></tr>}
                <tr className={cx(!r && !indisponivel && "is-aberta", indisponivel && "is-falta", marcados.has(l.key) && "is-marcada")} data-testid="linha-veiculo">
                  <td className="mt-vde__sel">{r && <input type="checkbox" checked={marcados.has(l.key)} onChange={() => alternar(l.key)} aria-label={`Marcar ${codigoDaLinha(l)}`} />}</td>
                  <td>
                    <span className="mt-vde__codigo">
                      {!r && <Lock size={14} weight="fill" aria-label="Pedido do evento" />}
                      {v ? <LinkNoLugar to={`/veiculos/${v.id}`} className="mt-reserva__evento">{codigoDaLinha(l)}</LinkNoLugar> : <span className="mt-vde__pedido" title={codigoDaLinha(l)}>{codigoDaLinha(l)}</span>}
                      {indisponivel && <span className="mt-vde__indisp" data-testid="nao-disponivel-selo" title="Este modelo foi pedido, mas não havia carro disponível. Fica registrado no evento.">Não disponível</span>}
                      {!r && !indisponivel && <button type="button" className="mt-vde__definir" onClick={() => setEscolhendo({ pedido: l.pedido })} data-testid="check-definido" title="Escolher o veículo deste pedido">Definir carro</button>}
                      {r && !r.reserva_inicio && <span className="mt-sem-data" title="Este carro está no evento, mas sem data: defina a chegada e a retirada" data-testid="sem-data">sem data</span>}
                      {choques.length > 0 && <span title={`Também está em: ${agendaTexto(choques, (x) => nomes.get(x) ?? "?", hojeLocal())}`} data-testid="aviso-conflito"><Warning size={16} weight="fill" /></span>}
                    </span>
                  </td>
                  {colunasInfo.map((c) => celula(l, li, c, textoDaCelula(c, l) || <span className="mt-vazio">—</span>))}
                  {ordenadas.map((c) => !r ? <td key={c}><span className="mt-vazio">—</span></td> : celula(l, li, c, c === "transporteIda" ? botaoTransporte(l, "ida") : c === "transporteVolta" ? botaoTransporte(l, "volta") : editavel(l, c as keyof typeof campos)))}
                  <td className="mt-vde__acoes">
                    {r && onSalvarChecklist && <Button variant="ghost" size="icon" aria-label={`Checklists de ${codigoDaLinha(l)}`} title="Checklists" onClick={() => setChecklist(l)}><ListChecks size={20} /></Button>}
                    {r && <Button variant="ghost" size="icon" aria-label={`Remover ${codigoDaLinha(l)} do evento`} onClick={() => void onRemoverReserva(r).catch((e: Error) => onErro(e.message))}><Trash size={20} /></Button>}
                    {!r && l.pedido && !l.pedido.nao_atendido && <Button variant="ghost" size="sm" onClick={() => void onNaoAtendido(l.pedido!.id, true).catch((e: Error) => onErro(e.message))} data-testid="nao-disponivel">Não estava disponível</Button>}
                    {!r && l.pedido?.nao_atendido && <Button variant="ghost" size="sm" onClick={() => void onNaoAtendido(l.pedido!.id, false).catch((e: Error) => onErro(e.message))}>Desfazer</Button>}
                  </td>
                </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="t-body-sm mt-vde__total" data-testid="custo-do-evento">Transportes do evento: <b>{custo.quantidade}</b> · custo planejado <b>{reais(custo.total)}</b> <span title="Arraste para selecionar células: Ctrl + C copia, Ctrl + V cola, Ctrl + D duplica para baixo">· dica: selecione células e use Ctrl + C / V / D</span></p>
      {ed.erro && <p className="mt-erro" role="alert"><span>{ed.erro}</span></p>}

      <AdicionarVeiculos aberto={!!escolhendo} onFechar={() => setEscolhendo(null)} evento={evento} veiculos={veiculos} reservas={reservas} eventos={eventos} manutencoes={manutencoes}
        pedidos={pedidoAlvo ? [pedidoAlvo] : desejados} onNaoAtendido={onNaoAtendido} onReservar={(ids, ini, fim, janela) => onReservar(evento.id, ids, ini, fim, janela, pedidoAlvo?.id)}
        onReservarSemData={onReservarSemData ? (ids) => onReservarSemData(evento.id, ids, pedidoAlvo?.id) : undefined} />
      <TransporteDoCarroSheet aberto={!!transporte} onFechar={() => { setTransporte(null); setMarcados(new Set()); }} tr={tr} eventoId={evento.id} reservaIds={transporte?.reservaIds ?? []}
        carro={transporte?.rotulo ?? ""} sentido={transporte?.sentido ?? "ida"} atual={transporte?.atual ?? null}
        rota={transporte ? rotaDoTransporte(transporte.sentido, [...reservas, ...reservasSemData].find((r) => r.id === transporte.reservaIds[0]) as Reserva | undefined, evento, locaisDoEvento) : { origem: null, destino: null }} />
      {onChecklistEmMassa && <ChecklistEmMassaSheet aberto={!!loteDeChecklist} onFechar={() => { setLoteDeChecklist(null); setMarcados(new Set()); }} momento="saida" carros={(loteDeChecklist ?? []).map((l) => ({ reservaId: l.reserva!.id, codigo: codigoDaLinha(l) }))} onConfirmar={onChecklistEmMassa} />}
      <Sheet open={!!checklist} onClose={() => setChecklist(null)} title="Checklists" wide>
        {checklist?.reserva && onSalvarChecklist && <ChecklistsDaReserva reservaId={checklist.reserva.id} carro={codigoDaLinha(checklist)} checklists={checklists} onSalvar={onSalvarChecklist} />}
      </Sheet>
    </div>
  );
}
