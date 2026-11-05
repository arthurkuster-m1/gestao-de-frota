import { Plus, Trash } from "@phosphor-icons/react";
import { Button, Field, Input, Select } from "../../ds";
import { UFS, type EventoLocalNovo } from "../../lib/eventos/tipos";

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
          <div className="vei-form__linha">
            <Field label="Endereço"><Input value={l.endereco} onChange={(e) => muda(i, { endereco: e.target.value })} placeholder="Rua, número" maxLength={300} /></Field>
            <Field label="Nome do local (opcional)"><Input value={l.rotulo ?? ""} onChange={(e) => muda(i, { rotulo: e.target.value })} maxLength={80} /></Field>
          </div>
          <div className="vei-form__linha">
            <Field label="Cidade"><Input value={l.cidade ?? ""} onChange={(e) => muda(i, { cidade: e.target.value })} /></Field>
            <Field label="Estado"><Select value={l.estado ?? ""} onChange={(e) => muda(i, { estado: e.target.value })} placeholder="Selecionar…"><option value="">—</option>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" icon={<Plus size={18} />} onClick={() => onChange([...locais, localVazio()])} data-testid="adicionar-local">Adicionar outro local</Button>
    </div>
  );
}
