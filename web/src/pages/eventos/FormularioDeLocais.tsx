import { Plus, Trash } from "@phosphor-icons/react";
import { Button, Field, Input } from "../../ds";
import { CampoDeEndereco } from "../../components/motor/EditorDeEndereco";
import { type EventoLocalNovo } from "../../lib/eventos/tipos";

export const localVazio = (): EventoLocalNovo => ({ rotulo: "", endereco: "", cidade: "", estado: "" });

/** Os endereços do evento: digitados a cada evento, quantos forem precisos. O primeiro é o principal. */
export function FormularioDeLocais({ locais, onChange }: { locais: EventoLocalNovo[]; onChange: (l: EventoLocalNovo[]) => void }) {
  const muda = (i: number, p: Partial<EventoLocalNovo>) => onChange(locais.map((l, k) => (k === i ? { ...l, ...p } : l)));
  return (
    <div className="ds-stack" data-testid="form-locais">
      {locais.map((l, i) => (
        <div key={i} className="vei-motorista" data-testid="bloco-local">
          <div className="ds-row" style={{ justifyContent: "space-between" }}>
            <span className="t-body" style={{ fontWeight: 700 }}>{locais.length > 1 ? `Local ${i + 1}` : "Local do evento"}</span>
            {locais.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Remover local ${i + 1}`} onClick={() => onChange(locais.filter((_, k) => k !== i))}><Trash size={20} /></Button>}
          </div>
          <Field label="Nome do local"><Input value={l.rotulo ?? ""} onChange={(e) => muda(i, { rotulo: e.target.value })} placeholder="Ex.: Pavilhão de Exposições" maxLength={80} /></Field>
          <Field label="Endereço completo"><CampoDeEndereco valor={l.endereco} onChange={(v) => muda(i, { endereco: v })} titulo="Endereço do local" /></Field>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" icon={<Plus size={18} />} onClick={() => onChange([...locais, localVazio()])} data-testid="adicionar-local">Adicionar outro local</Button>
    </div>
  );
}
