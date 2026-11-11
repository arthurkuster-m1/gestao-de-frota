import { useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { Button, Input, Sheet } from "../../ds";
import { criarDepartamento, excluirDepartamento, renomearDepartamento, useDepartamentos, type Departamento } from "../../lib/veiculos/departamentos";
import { DEPARTAMENTO_PADRAO } from "../../lib/veiculos/tipos";

/** Os departamentos dos veículos: criar, renomear e apagar. Marketing é o padrão e fica sempre. */
export function GerenciarDepartamentos() {
  const lista = useDepartamentos();
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<{ nome: string; texto: string } | null>(null);
  const [apagando, setApagando] = useState<Departamento | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const rodar = async (fn: () => Promise<void>) => { setFalha(null); setOcupado(true); try { await fn(); } catch (e) { setFalha((e as Error).message); } finally { setOcupado(false); } };
  return (
    <div className="ds-stack" data-testid="departamentos">
      <p className="t-body-sm t-muted">Todo veículo é do <b>Marketing</b> por padrão. Crie um departamento para identificar carros emprestados (RP, UC, Acessórios, ou outro).</p>
      <ul className="mt-escolha" role="list">
        {lista.map((d) => {
          const padrao = d.nome.toLowerCase() === DEPARTAMENTO_PADRAO.toLowerCase();
          return (
            <li key={d.nome} className="mt-escolha__item">
              <div className="mt-escolha__linha" style={{ gap: 10 }}>
                {editando?.nome === d.nome
                  ? <Input value={editando.texto} autoFocus aria-label={`Nome do departamento ${d.nome}`} maxLength={60} onChange={(e) => setEditando({ nome: d.nome, texto: e.target.value })}
                      onBlur={() => { const x = editando; setEditando(null); if (x.texto.trim() && x.texto.trim() !== d.nome) void rodar(() => renomearDepartamento(d, x.texto)); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditando(null); }} />
                  : <button type="button" className="mt-escolha__nome" disabled={padrao} style={{ background: "transparent", border: 0, font: "inherit", textAlign: "left", cursor: padrao ? "default" : "text", flex: 1 }} title={padrao ? "Departamento padrão" : "Clique para renomear"} onClick={() => setEditando({ nome: d.nome, texto: d.nome })}>{d.nome}{padrao && <span className="t-body-sm t-muted"> · padrão</span>}</button>}
                {!padrao && <Button variant="ghost" size="icon" aria-label={`Excluir o departamento ${d.nome}`} onClick={() => setApagando(d)} data-testid="excluir-departamento"><Trash size={18} /></Button>}
              </div>
            </li>
          );
        })}
      </ul>
      <form className="ds-row" style={{ flexWrap: "wrap", gap: 10 }} onSubmit={(e) => { e.preventDefault(); void rodar(async () => { await criarDepartamento(novo); setNovo(""); }); }}>
        <Input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Novo departamento" aria-label="Nome do novo departamento" maxLength={60} style={{ maxWidth: 320 }} />
        <Button type="submit" icon={<Plus size={18} />} disabled={!novo.trim()} loading={ocupado} data-testid="adicionar-departamento">Adicionar departamento</Button>
      </form>
      {falha && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{falha}</p>}
      <Sheet open={!!apagando} onClose={() => setApagando(null)} title="Excluir departamento">
        <div className="ds-stack">
          <p className="t-body">Excluir <b>{apagando?.nome}</b> da lista? Os veículos desse departamento continuam com o nome dele escrito. Para movê-los, mude o departamento deles na tabela de veículos.</p>
          <Button variant="danger" size="lg" block loading={ocupado} data-testid="confirmar-exclusao-departamento" onClick={() => { const d = apagando!; void rodar(async () => { await excluirDepartamento(d); setApagando(null); }); }}>Excluir departamento</Button>
          <Button variant="secondary" size="lg" block onClick={() => setApagando(null)}>Cancelar</Button>
        </div>
      </Sheet>
    </div>
  );
}
