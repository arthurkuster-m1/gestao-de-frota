import { useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { Button, Input, Sheet, Switch } from "../../ds";
import { atualizarTipo, criarTipo, excluirTipo, useTiposDeEvento, type TipoDeEvento } from "../../lib/eventos/tiposDeEvento";

/** Os tipos de evento: criar, renomear, apagar e marcar os em que os carros NÃO voltam (sem transporte de retorno, sem solicitar retorno). */
export function GerenciarTiposDeEvento() {
  const { tipos } = useTiposDeEvento();
  const [novo, setNovo] = useState("");
  const [novoSemRetorno, setNovoSemRetorno] = useState(false);
  const [editando, setEditando] = useState<{ nome: string; texto: string } | null>(null);
  const [apagando, setApagando] = useState<TipoDeEvento | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const rodar = async (fn: () => Promise<void>) => { setFalha(null); setOcupado(true); try { await fn(); } catch (e) { setFalha((e as Error).message); } finally { setOcupado(false); } };

  return (
    <div className="ds-stack" data-testid="tipos-de-evento">
      <p className="t-body-sm t-muted">Os tipos aparecem ao criar e editar um evento. Em um tipo marcado como <b>os carros não voltam</b>, o evento não tem transporte de retorno nem solicitação de retorno, e o status "Concluído" é marcado à mão.</p>
      <ul className="mt-escolha" role="list">
        {tipos.map((t) => (
          <li key={t.nome} className="mt-escolha__item">
            <div className="mt-escolha__linha" style={{ gap: 10, flexWrap: "wrap" }}>
              {editando?.nome === t.nome
                ? <Input value={editando.texto} autoFocus aria-label={`Nome do tipo ${t.nome}`} maxLength={80} onChange={(e) => setEditando({ nome: t.nome, texto: e.target.value })}
                    onBlur={() => { const x = editando; setEditando(null); if (x.texto.trim() && x.texto.trim() !== t.nome) void rodar(() => atualizarTipo(t, { nome: x.texto })); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditando(null); }} />
                : <button type="button" className="mt-escolha__nome" style={{ background: "transparent", border: 0, font: "inherit", textAlign: "left", cursor: "text", flex: 1 }} title="Clique para renomear" onClick={() => setEditando({ nome: t.nome, texto: t.nome })}>{t.nome}</button>}
              <Switch checked={t.semRetorno} onChange={(v) => void rodar(() => atualizarTipo(t, { semRetorno: v }))} label="Os carros não voltam" />
              <Button variant="ghost" size="icon" aria-label={`Excluir o tipo ${t.nome}`} onClick={() => setApagando(t)} data-testid="excluir-tipo"><Trash size={18} /></Button>
            </div>
          </li>
        ))}
      </ul>
      <form className="ds-row" style={{ flexWrap: "wrap", gap: 10 }} onSubmit={(e) => { e.preventDefault(); void rodar(async () => { await criarTipo(novo, novoSemRetorno); setNovo(""); setNovoSemRetorno(false); }); }}>
        <Input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Novo tipo de evento" aria-label="Nome do novo tipo" maxLength={80} style={{ maxWidth: 320 }} />
        <Switch checked={novoSemRetorno} onChange={setNovoSemRetorno} label="Os carros não voltam" />
        <Button type="submit" icon={<Plus size={18} />} disabled={!novo.trim()} loading={ocupado} data-testid="adicionar-tipo">Adicionar tipo</Button>
      </form>
      {falha && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{falha}</p>}
      <Sheet open={!!apagando} onClose={() => setApagando(null)} title="Excluir tipo de evento">
        <div className="ds-stack">
          <p className="t-body">Excluir o tipo <b>{apagando?.nome}</b> da lista? Os eventos que já têm esse tipo continuam com ele escrito.</p>
          <Button variant="danger" size="lg" block loading={ocupado} data-testid="confirmar-exclusao-tipo" onClick={() => { const t = apagando!; void rodar(async () => { await excluirTipo(t); setApagando(null); }); }}>Excluir tipo</Button>
          <Button variant="secondary" size="lg" block onClick={() => setApagando(null)}>Cancelar</Button>
        </div>
      </Sheet>
    </div>
  );
}
