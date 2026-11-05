import { useState } from "react";
import { Copy, DotsThree, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { Button, Field, Input, Segmented, Sheet, cx } from "../../ds";
import { MAXIMO_DE_VISUALIZACOES, ROTULO_DO_TIPO, TIPOS_DE_VISUALIZACAO, type TipoDeVisualizacao, type VisaoSalva } from "../../lib/motor/visoes";
import { Painel } from "./Painel";

/** Tipos que já têm tela. Os outros aparecem como "em breve" . */
const DISPONIVEIS: readonly TipoDeVisualizacao[] = ["tabela", "galeria", "timeline"];

type Props = {
  visoes: VisaoSalva[]; abaId: string; onAba: (id: string) => void; alterada: boolean; ocupado?: boolean; erro?: string | null;
  onCriar: (nome: string, tipo: TipoDeVisualizacao) => Promise<void>;
  onSalvar: () => Promise<void>; onDescartar: () => void;
  onRenomear: (id: string, nome: string) => Promise<void>; onDuplicar: (v: VisaoSalva) => Promise<void>; onExcluir: (id: string) => Promise<void>;
};

export function AbasDeVisualizacao({ visoes, abaId, onAba, alterada, ocupado, erro, onCriar, onSalvar, onDescartar, onRenomear, onDuplicar, onExcluir }: Props) {
  const [criando, setCriando] = useState(false);
  const [renomeando, setRenomeando] = useState<VisaoSalva | null>(null);
  const [excluindo, setExcluindo] = useState<VisaoSalva | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoDeVisualizacao>("tabela");
  const [falha, setFalha] = useState<string | null>(null);
  const ativa = visoes.find((v) => v.id === abaId);
  const aba = (id: string, texto: string) => (
    <button key={id} type="button" role="tab" aria-selected={abaId === id} className={cx("mt-aba", abaId === id && "is-on")} onClick={() => onAba(id)} data-testid="aba">{texto}</button>
  );
  async function envia(fn: () => Promise<void>, fechar: () => void) { setFalha(null); try { await fn(); fechar(); } catch (e) { setFalha((e as Error).message); } }

  return (
    <div className="mt-abas-wrap">
      <div className="mt-abas" role="tablist" aria-label="Visualizações">
        {aba("todas", "Todas")}
        {visoes.map((v) => aba(v.id, v.nome))}
        <button type="button" className="mt-aba mt-aba--nova" aria-label="Nova visualização" disabled={visoes.length >= MAXIMO_DE_VISUALIZACOES} onClick={() => { setNome(""); setTipo("tabela"); setFalha(null); setCriando(true); }} data-testid="nova-aba"><Plus size={18} /></button>
        {ativa && (
          <Painel rotulo="" icone={<DotsThree size={20} weight="bold" />} largura={240} testid="menu-aba">
            <div className="mt-painel__corpo">
              <button type="button" className="mt-item" onClick={() => { setNome(ativa.nome); setFalha(null); setRenomeando(ativa); }}><PencilSimple size={18} />Renomear</button>
              <button type="button" className="mt-item" onClick={() => void onDuplicar(ativa)}><Copy size={18} />Duplicar</button>
              <button type="button" className="mt-item mt-item--perigo" onClick={() => { setFalha(null); setExcluindo(ativa); }}><Trash size={18} />Excluir</button>
            </div>
          </Painel>
        )}
      </div>

      {alterada && (
        <div className="mt-alterada" role="status" data-testid="barra-alterada">
          <span className="t-body-sm">{ativa ? "Alterações não salvas nesta visualização." : "Você mudou filtros ou colunas."}</span>
          <div className="ds-row">
            {ativa ? (<><Button size="sm" variant="secondary" onClick={onDescartar}>Descartar</Button><Button size="sm" loading={ocupado} onClick={() => void onSalvar()} data-testid="salvar-visao">Salvar</Button></>)
              : (<><Button size="sm" variant="secondary" onClick={onDescartar} data-testid="restaurar-todas">Restaurar padrão</Button><Button size="sm" onClick={() => { setNome(""); setTipo("tabela"); setFalha(null); setCriando(true); }} data-testid="salvar-como">Salvar como visualização</Button></>)}
          </div>
        </div>
      )}
      {erro && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{erro}</p>}

      <Sheet open={criando} onClose={() => setCriando(false)} title="Nova visualização">
        <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void envia(() => onCriar(nome, tipo), () => setCriando(false)); }}>
          <Field label="Nome" error={falha}><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Disponíveis" maxLength={60} autoFocus /></Field>
          <Field label="Tipo"><Segmented block options={TIPOS_DE_VISUALIZACAO.filter((t) => t === "tabela" || t === "galeria" || t === "timeline").map((t) => ({ value: t, label: DISPONIVEIS.includes(t) ? ROTULO_DO_TIPO[t] : `${ROTULO_DO_TIPO[t]} · em breve` }))} value={tipo} onChange={(t) => { if (DISPONIVEIS.includes(t)) setTipo(t); }} /></Field>
          <p className="t-body-sm t-muted">A visualização guarda os filtros, a ordem, o agrupamento e as colunas que estão na tela agora.</p>
          <Button type="submit" size="lg" block disabled={!nome.trim()} loading={ocupado}>Criar visualização</Button>
        </form>
      </Sheet>
      <Sheet open={!!renomeando} onClose={() => setRenomeando(null)} title="Renomear visualização">
        <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); if (renomeando) void envia(() => onRenomear(renomeando.id, nome), () => setRenomeando(null)); }}>
          <Field label="Nome" error={falha}><Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} autoFocus /></Field>
          <Button type="submit" size="lg" block disabled={!nome.trim()}>Salvar nome</Button>
        </form>
      </Sheet>
      <Sheet open={!!excluindo} onClose={() => setExcluindo(null)} title="Excluir visualização">
        <div className="ds-stack">
          <p className="t-body">Excluir <b>{excluindo?.nome}</b>? Os veículos não são afetados, só essa forma de ver.</p>
          {falha && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{falha}</p>}
          <Button variant="danger" size="lg" block onClick={() => excluindo && void envia(() => onExcluir(excluindo.id), () => setExcluindo(null))}>Excluir</Button>
        </div>
      </Sheet>
    </div>
  );
}
