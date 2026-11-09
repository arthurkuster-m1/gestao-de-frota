import { useMemo } from "react";
import { ArrowsDownUp, Funnel, Plus, Rows, Trash } from "@phosphor-icons/react";
import { Button, Select, Segmented } from "../../ds";
import { OPERADORES_DO_TIPO, TIPOS_AGRUPAVEIS, semValor, type ConsultaDaTabela, type Filtro, type Operador } from "../../lib/motor/consulta";
import { CampoDeValor } from "./CampoDeValor";
import { Painel } from "./Painel";
import { rotuloDoOperador } from "./rotulos";
import type { CampoDaTela, OpcaoDoCampo } from "./tipos";

type Props<T> = { campos: readonly CampoDaTela<T>[]; linhas: readonly T[]; consulta: ConsultaDaTabela; onChange: (c: ConsultaDaTabela) => void };

/** Opções de um campo: as fixas da tela, ou os valores que existem nas linhas (para escolher sem digitar). */
export function opcoesDoCampo<T>(campo: CampoDaTela<T>, linhas: readonly T[]): readonly OpcaoDoCampo[] {
  if (campo.opcoes) return campo.opcoes;
  const set = new Set<string>();
  for (const l of linhas) { const v = campo.valorDe(l); if (Array.isArray(v)) v.forEach((x) => set.add(String(x))); else if (typeof v === "string" && v !== "") set.add(v); }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })).map((v) => ({ value: v, label: campo.rotuloDoValor?.(v) ?? v }));
}

export function BarraDeConsulta<T>({ campos, linhas, consulta, onChange }: Props<T>) {
  const filtros = consulta.filtros ?? [];
  const ordenacao = consulta.ordenacao ?? [];
  const porId = useMemo(() => new Map(campos.map((c) => [c.id, c])), [campos]);
  const salvar = (p: Partial<ConsultaDaTabela>) => onChange({ ...consulta, ...p });

  const trocaFiltro = (i: number, f: Filtro) => salvar({ filtros: filtros.map((x, k) => (k === i ? f : x)) });
  const novoFiltro = () => { const c = campos[0]!; salvar({ filtros: [...filtros, { campo: c.id, operador: OPERADORES_DO_TIPO[c.tipo][0]!, ...(filtros.length ? { juncao: "e" as const } : {}) }] }); };

  return (
    <div className="mt-barra" data-testid="barra-consulta">
      <Painel soIcone rotulo="Filtrar" icone={<Funnel size={18} />} contagem={filtros.length} testid="painel-filtrar">
        <div className="mt-painel__corpo">
          {filtros.length === 0 && <p className="t-body-sm t-muted">Nenhum filtro. Adicione um para ver só parte dos veículos.</p>}
          {filtros.map((f, i) => {
            const campo = porId.get(f.campo);
            const tipo = campo?.tipo ?? "texto";
            return (
              <div key={i} className="mt-filtro" data-testid="linha-filtro">
                <div className="mt-filtro__topo">
                  {i === 0 ? <span className="mt-filtro__onde">Onde</span> : (
                    <div className="mt-filtro__juncao"><Select aria-label="Ligação com o filtro anterior" value={f.juncao ?? "e"} onChange={(e) => trocaFiltro(i, { ...f, juncao: e.target.value as "e" | "ou" })}><option value="e">E</option><option value="ou">OU</option></Select></div>
                  )}
                  <div className="mt-filtro__campo"><Select aria-label="Propriedade" value={f.campo} onChange={(e) => { const c = porId.get(e.target.value)!; trocaFiltro(i, { campo: c.id, operador: OPERADORES_DO_TIPO[c.tipo][0]!, ...(f.juncao ? { juncao: f.juncao } : {}) }); }}>{campos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}</Select></div>
                  <div className="mt-filtro__op"><Select aria-label="Condição" value={f.operador} onChange={(e) => { const op = e.target.value as Operador; trocaFiltro(i, { ...f, operador: op, ...(semValor(op) ? { valor: undefined } : {}) }); }}>{OPERADORES_DO_TIPO[tipo].map((o) => <option key={o} value={o}>{rotuloDoOperador(o, tipo)}</option>)}</Select></div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remover filtro" onClick={() => salvar({ filtros: filtros.filter((_, k) => k !== i) })}><Trash size={20} /></Button>
                </div>
                {campo && !semValor(f.operador) && <div className="mt-filtro__valor"><CampoDeValor tipo={tipo} operador={f.operador} valor={f.valor} opcoes={opcoesDoCampo(campo, linhas)} onChange={(v) => trocaFiltro(i, { ...f, valor: v })} /></div>}
              </div>
            );
          })}
          <div className="ds-row" style={{ justifyContent: "space-between" }}>
            <Button type="button" variant="secondary" size="sm" icon={<Plus size={18} />} onClick={novoFiltro} data-testid="novo-filtro">Adicionar filtro</Button>
            {filtros.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => salvar({ filtros: undefined })}>Limpar filtros</Button>}
          </div>
          {filtros.some((f) => f.juncao === "ou") && <p className="t-body-sm t-muted">O <b>E</b> prende mais forte que o <b>OU</b>: “A e B ou C” vale como “(A e B) ou C”.</p>}
        </div>
      </Painel>

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
