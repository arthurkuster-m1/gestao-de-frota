import { useState } from "react";
import { Button, Field, Input, Select, Sheet } from "../../ds";
import { TIPOS_EVENTO, type Evento, type EventoLocalNovo } from "../../lib/eventos/tipos";
import { FormularioDeLocais, localVazio } from "./FormularioDeLocais";

/** O formulário de novo evento: nome, tipo, solicitante e os locais digitados (um ou vários). */
export function NovoEvento({ aberto, onFechar, onCriar, onCriado }: {
  aberto: boolean; onFechar: () => void;
  onCriar: (e: { nome: string; tipo: string | null; solicitante: string | null }, locais: EventoLocalNovo[]) => Promise<Evento>; onCriado: (e: Evento) => void;
}) {
  const [novo, setNovo] = useState({ nome: "", tipo: "", solicitante: "" });
  const [locais, setLocais] = useState<EventoLocalNovo[]>([localVazio()]);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function criar() {
    setFalha(null); setEnviando(true);
    try {
      const e = await onCriar({ nome: novo.nome, tipo: novo.tipo || null, solicitante: novo.solicitante.trim() || null }, locais);
      setNovo({ nome: "", tipo: "", solicitante: "" }); setLocais([localVazio()]); onFechar(); onCriado(e);
    } catch (x) { setFalha((x as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title="Novo evento">
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
        <Field label="Nome do evento" error={falha}><Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Ex.: Convenção Tesouraria" maxLength={120} autoFocus /></Field>
        <div className="vei-form__linha">
          <Field label="Tipo"><Select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })} placeholder="Escolher…"><option value="">Sem tipo</option>{TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
          <Field label="Solicitante"><Input value={novo.solicitante} onChange={(e) => setNovo({ ...novo, solicitante: e.target.value })} /></Field>
        </div>
        <FormularioDeLocais locais={locais} onChange={setLocais} />
        <p className="t-body-sm t-muted">Depois de criar, você escolhe os carros, a chegada e a retirada.</p>
        <Button type="submit" size="lg" block disabled={!novo.nome.trim()} loading={enviando} data-testid="criar-evento">Criar evento</Button>
      </form>
    </Sheet>
  );
}
