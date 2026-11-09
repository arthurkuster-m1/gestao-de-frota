import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowsDownUp, CaretDown, Funnel, MagnifyingGlass, Plus, Rows, Trash } from "@phosphor-icons/react";
import { Button, Select, Segmented, cx } from "../../ds";
import { usePopover } from "../../ds/popover";
import { OPERADORES_DO_TIPO, TIPOS_AGRUPAVEIS, semValor, type ConsultaDaTabela, type Filtro, type Operador } from "../../lib/motor/consulta";
import { CampoDeValor } from "./CampoDeValor";
import { Painel } from "./Painel";
import { ROTULO_DA_DATA, ROTULO_DO_PERIODO, rotuloDoOperador } from "./rotulos";
import type { CampoDaTela, OpcaoDoCampo } from "./tipos";

type Props<T> = { campos: readonly CampoDaTela<T>[]; linhas: readonly T[]; consulta: ConsultaDaTabela; onChange: (c: ConsultaDaTabela) => void; /** Avisa qual filtro acabou de ser criado (para a tela abrir o editor dele). */ aoAdicionar?: (indice: number) => void };

/** Opções de um campo: as fixas da tela, ou os valores que existem nas linhas (para escolher sem digitar). */
export function opcoesDoCampo<T>(campo: CampoDaTela<T>, linhas: readonly T[]): readonly OpcaoDoCampo[] {
  if (campo.opcoes) return campo.opcoes;
  const set = new Set<string>();
  for (const l of linhas) { const v = campo.valorDe(l); if (Array.isArray(v)) v.forEach((x) => set.add(String(x))); else if (typeof v === "string" && v !== "") set.add(v); }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })).map((v) => ({ value: v, label: campo.rotuloDoValor?.(v) ?? v }));
}

export function BarraDeConsulta<T>({ campos, linhas: _linhas, consulta, onChange, aoAdicionar }: Props<T>) {
  const filtros = consulta.filtros ?? [];
  const ordenacao = consulta.ordenacao ?? [];
  const porId = useMemo(() => new Map(campos.map((c) => [c.id, c])), [campos]);
  const salvar = (p: Partial<ConsultaDaTabela>) => onChange({ ...consulta, ...p });

  const adicionar = (c: CampoDaTela<T>) => { salvar({ filtros: [...filtros, { campo: c.id, operador: OPERADORES_DO_TIPO[c.tipo][0]!, ...(filtros.length ? { juncao: "e" as const } : {}) }] }); aoAdicionar?.(filtros.length); };

  return (
    <div className="mt-barra" data-testid="barra-consulta">
      <NovoFiltro campos={campos} contagem={filtros.length} onEscolher={adicionar} onLimpar={filtros.length ? () => salvar({ filtros: undefined }) : undefined} />

      <Painel soIcone rotulo="Ordenar" icone={<ArrowsDownUp size={18} />} contagem={ordenacao.length} testid="painel-ordenar" largura={440}>
        <div className="mt-painel__corpo">
          {ordenacao.length === 0 && <p className="t-body-sm t-muted">Sem ordenação: a ordem é a de cadastro. Clicar no título de uma coluna também ordena.</p>}
          {ordenacao.map((o, i) => (
            <div key={i} className="mt-filtro__topo" data-testid="linha-ordem">
              <div className="mt-filtro__campo"><Select aria-label="Ordenar por" value={o.campo} onChange={(e) => salvar({ ordenacao: ordenacao.map((x, k) => (k === i ? { ...x, campo: e.target.value } : x)) })}>{campos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}</Select></div>
              <Segmented options={[{ value: "asc", label: "A→Z" }, { value: "desc", label: "Z→A" }]} value={o.direcao} onChange={(d) => salvar({ ordenacao: ordenacao.map((x, k) => (k === i ? { ...x, direcao: d } : x)) })} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remover ordenação" onClick={() => salvar({ ordenacao: ordenacao.filter((_, k) => k !== i) })}><Trash size={20} /></Button>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" icon={<Plus size={18} />} onClick={() => salvar({ ordenacao: [...ordenacao, { campo: campos.find((c) => !ordenacao.some((o) => o.campo === c.id))?.id ?? campos[0]!.id, direcao: "asc" }] })}>Adicionar ordenação</Button>
        </div>
      </Painel>

      <Painel soIcone rotulo="Agrupar" icone={<Rows size={18} />} contagem={consulta.agrupar ? 1 : 0} testid="painel-agrupar" largura={400}>
        <div className="mt-painel__corpo">
          <Select aria-label="Agrupar por" value={consulta.agrupar ?? ""} onChange={(e) => salvar({ agrupar: e.target.value || undefined })}>
            <option value="">Sem agrupamento</option>
            {campos.filter((c) => TIPOS_AGRUPAVEIS.includes(c.tipo)).map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
          </Select>
          {consulta.agrupar && porId.get(consulta.agrupar)?.tipo === "data" && (
            <Segmented options={[{ value: "dia", label: "Dia" }, { value: "semana", label: "Semana" }, { value: "mes", label: "Mês" }]} value={consulta.agruparPor ?? "dia"} onChange={(g) => salvar({ agruparPor: g })} />
          )}
          {consulta.agrupar && <Segmented options={[{ value: "asc", label: "Ordem crescente" }, { value: "desc", label: "Decrescente" }]} value={consulta.ordemDosGrupos ?? "asc"} onChange={(d) => salvar({ ordemDosGrupos: d })} />}
        </div>
      </Painel>
    </div>
  );
}

/** Escolher a PROPRIEDADE de um filtro novo (como no Notion: primeiro a propriedade, depois o valor). */
export function NovoFiltro<T>({ campos, contagem, onEscolher, onLimpar, comoChip }: { campos: readonly CampoDaTela<T>[]; contagem?: number; onEscolher: (c: CampoDaTela<T>) => void; onLimpar?: () => void; comoChip?: boolean }) {
  const [q, setQ] = useState("");
  const lista = useMemo(() => { const t = q.trim().toLowerCase(); return campos.filter((c) => !t || c.titulo.toLowerCase().includes(t)); }, [campos, q]);
  return (
    <Painel soIcone={!comoChip} rotulo={comoChip ? "Filtro" : "Filtrar"} icone={comoChip ? <Plus size={14} /> : <Funnel size={18} />} contagem={comoChip ? 0 : contagem} testid={comoChip ? "mais-filtro" : "painel-filtrar"} largura={280}>
      <div className="mt-painel__corpo mt-escolher-prop" data-testid="escolher-propriedade">
        <div className="mt-escolher-prop__busca"><MagnifyingGlass size={16} aria-hidden /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por…" aria-label="Filtrar por propriedade" /></div>
        <div className="mt-escolher-prop__lista" role="listbox" aria-label="Propriedades">
          {lista.length === 0 && <p className="t-body-sm t-muted">Nenhuma propriedade.</p>}
          {lista.map((c) => <button key={c.id} type="button" role="option" aria-selected={false} className="mt-item" onClick={() => { setQ(""); onEscolher(c); }}>{c.titulo}</button>)}
        </div>
        {onLimpar && !comoChip && <button type="button" className="mt-item mt-item--perigo" onClick={onLimpar} data-testid="limpar-filtros"><Trash size={16} />Limpar todos os filtros</button>}
      </div>
    </Painel>
  );
}

const resumoDoValor = (f: Filtro, tipo: string, opcoes: readonly OpcaoDoCampo[]): string => {
  const v = f.valor;
  if (semValor(f.operador) || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return "";
  if (Array.isArray(v)) return v.map((x) => opcoes.find((o) => o.value === x)?.label ?? x).join(", ");
  if (tipo === "data" && typeof v === "string") return ROTULO_DA_DATA[v] ?? ROTULO_DO_PERIODO[v] ?? v.split("-").reverse().join("/");
  if (typeof v === "string") return opcoes.find((o) => o.value === v)?.label ?? v;
  return String(v);
};
const OPERADOR_PADRAO = new Set<string>(["contem", "e", "igual"]);

/** Um filtro como "chip" (Propriedade: valor). Clicar abre um painel pequeno: o formato do filtro (contém, antes de, maior que…) e o valor. */
function ChipDeFiltro<T>({ filtro, indice, campo, opcoes, abrir, aoAbrir, onChange, onRemover }: {
  filtro: Filtro; indice: number; campo: CampoDaTela<T> | undefined; opcoes: readonly OpcaoDoCampo[]; abrir: boolean; aoAbrir: () => void; onChange: (f: Filtro) => void; onRemover: () => void;
}) {
  const gatilho = useRef<HTMLButtonElement>(null);
  const { ref, aberto, setAberto } = usePopover(gatilho, { largura: Math.min(320, typeof window === "undefined" ? 320 : window.innerWidth - 16), alturaMax: 420 });
  useEffect(() => { if (abrir) { const t = window.setTimeout(() => { setAberto(true); aoAbrir(); }, 60); return () => window.clearTimeout(t); } }, [abrir, setAberto, aoAbrir]);
  const tipo = campo?.tipo ?? "texto";
  const resumo = resumoDoValor(filtro, tipo, opcoes);
  const comValor = !!resumo || semValor(filtro.operador);
  const prefixo = OPERADOR_PADRAO.has(filtro.operador) || !campo ? "" : `${rotuloDoOperador(filtro.operador, tipo)} `;
  return (
    <>
      <button ref={gatilho} type="button" className={cx("mt-chip", comValor && "is-on")} aria-expanded={aberto} data-testid="chip-filtro" onClick={() => setAberto(!aberto)}>
        {indice > 0 && <span className="mt-chip__juncao">{filtro.juncao === "ou" ? "ou" : "e"}</span>}
        <b>{campo?.titulo ?? filtro.campo}</b>{comValor ? <span className="mt-chip__valor">{semValor(filtro.operador) ? rotuloDoOperador(filtro.operador, tipo) : `${prefixo}${resumo}`}</span> : null}<CaretDown size={12} />
      </button>
      <div ref={ref} popover="auto" className="ds-pop mt-painel mt-chip__painel" data-testid="painel-chip">
        <div className="mt-chip__topo">
          {indice > 0 && <span className="mt-mini"><Select aria-label="Ligação com o filtro anterior" value={filtro.juncao ?? "e"} onChange={(e) => onChange({ ...filtro, juncao: e.target.value as "e" | "ou" })}><option value="e">E</option><option value="ou">OU</option></Select></span>}
          <span className="mt-chip__prop">{campo?.titulo ?? filtro.campo}</span>
          <span className="mt-mini"><Select aria-label="Formato do filtro" value={filtro.operador} onChange={(e) => { const op = e.target.value as Operador; onChange({ ...filtro, operador: op, ...(semValor(op) ? { valor: undefined } : {}) }); }}>{OPERADORES_DO_TIPO[tipo].map((o) => <option key={o} value={o}>{rotuloDoOperador(o, tipo)}</option>)}</Select></span>
          <button type="button" className="mt-chip__lixo" aria-label="Remover filtro" title="Remover filtro" onClick={() => { setAberto(false); onRemover(); }}><Trash size={16} /></button>
        </div>
        {campo && !semValor(filtro.operador) && <div className="mt-chip__valorbox"><CampoDeValor tipo={tipo} operador={filtro.operador} valor={filtro.valor} opcoes={opcoes} onChange={(v) => onChange({ ...filtro, valor: v })} /></div>}
        {!campo && <p className="t-body-sm t-muted">Essa propriedade não existe mais.</p>}
      </div>
    </>
  );
}

/** A fileira de filtros (chips) logo abaixo da linha de visualizações, com o "+ Filtro" no fim. */
export function ChipsDeFiltro<T>({ campos, linhas, consulta, onChange, abrirIndice, aoAbrir, aoAdicionar }: { campos: readonly CampoDaTela<T>[]; linhas: readonly T[]; consulta: ConsultaDaTabela; onChange: (c: ConsultaDaTabela) => void; abrirIndice: number | null; aoAbrir: () => void; aoAdicionar: (i: number) => void }) {
  const filtros = consulta.filtros ?? [];
  const porId = useMemo(() => new Map(campos.map((c) => [c.id, c])), [campos]);
  if (filtros.length === 0) return null;
  const troca = (i: number, f: Filtro) => onChange({ ...consulta, filtros: filtros.map((x, k) => (k === i ? f : x)) });
  return (
    <div className="mt-chips" data-testid="chips-de-filtro" role="group" aria-label="Filtros">
      {filtros.map((f, i) => { const campo = porId.get(f.campo); return (
        <ChipDeFiltro key={i} filtro={f} indice={i} campo={campo} opcoes={campo ? opcoesDoCampo(campo, linhas) : []} abrir={abrirIndice === i} aoAbrir={aoAbrir}
          onChange={(nf) => troca(i, nf)} onRemover={() => onChange({ ...consulta, filtros: filtros.length > 1 ? filtros.filter((_, k) => k !== i).map((x, k) => (k === 0 ? { ...x, juncao: undefined } : x)) : undefined })} />
      ); })}
      <NovoFiltro campos={campos} comoChip onEscolher={(c) => { onChange({ ...consulta, filtros: [...filtros, { campo: c.id, operador: OPERADORES_DO_TIPO[c.tipo][0]!, juncao: "e" }] }); aoAdicionar(filtros.length); }} />
    </div>
  );
}
