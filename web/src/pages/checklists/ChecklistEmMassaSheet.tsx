import { useEffect, useState } from "react";
import { Button, DateField, Field, Input, Select, Sheet, Textarea } from "../../ds";
import { paraInstante } from "../../lib/checklists/regras";
import { COMBUSTIVEIS, LIMPEZAS, rotuloMomento, type ChecklistNovo, type Momento } from "../../lib/checklists/tipos";
import { hojeLocal } from "../../lib/motor/datas";
import "../veiculos/veiculos.css";

export type DadosEmMassa = Omit<ChecklistNovo, "reserva_id" | "momento" | "km">;
const mascaraDeHora = (t: string) => { const d = t.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d; };
const horaOk = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const horaAgora = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

/**
 * O MESMO checklist para vários carros de uma vez ("saiu agora, neste dia, para este evento"). O que importa é o registro da saída com a data
 * (que dá para trocar); combustível, limpeza, quem recebeu e observações são opcionais, e o km de cada carro se completa depois na ficha dele.
 */
export function ChecklistEmMassaSheet({ aberto, onFechar, momento = "saida", titulo, carros, onConfirmar }: {
  aberto: boolean; onFechar: () => void; momento?: Momento; titulo?: string; carros: { reservaId: string; codigo: string }[];
  onConfirmar: (reservaIds: string[], dados: DadosEmMassa) => Promise<void>;
}) {
  const [f, setF] = useState({ dia: hojeLocal(), hora: horaAgora(), combustivel: "", limpeza: "", recebido: "", obs: "" });
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (aberto) { setF({ dia: hojeLocal(), hora: horaAgora(), combustivel: "", limpeza: "", recebido: "", obs: "" }); setFalha(null); } }, [aberto]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function confirmar() {
    setFalha(null); setEnviando(true);
    try {
      await onConfirmar(carros.map((c) => c.reservaId), { data_hora: paraInstante(f.dia || hojeLocal(), f.hora), combustivel: f.combustivel || null, limpeza: f.limpeza || null, recebido_por: f.recebido.trim() || null, teve_avarias: false, avarias: null, observacoes: f.obs.trim() || null });
      onFechar();
    } catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title={titulo ?? `Checklist de ${rotuloMomento(momento).toLowerCase()} em massa`}>
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void confirmar(); }} data-testid="form-checklist-em-massa">
        <p className="t-body-sm t-muted">{carros.length} carro{carros.length === 1 ? "" : "s"} sem checklist de {rotuloMomento(momento).toLowerCase()}. Ao confirmar, {momento === "saida" ? "cada reserva passa para Em uso" : "cada reserva passa para Concluído"} e o histórico do carro registra o checklist.</p>
        <div className="mt-chk-carros" data-testid="carros-do-checklist">{carros.map((c) => <span key={c.reservaId} className="mt-rap__chip">{c.codigo}</span>)}</div>
        <div className="vei-form__linha">
          <Field label={momento === "saida" ? "Dia da saída" : "Dia do retorno"}><DateField value={f.dia} onChange={(e) => set("dia", e.target.value)} /></Field>
          <Field label="Hora" error={f.hora && f.hora.length === 5 && !horaOk(f.hora) ? "Hora inválida." : null}><Input inputMode="numeric" value={f.hora} onChange={(e) => set("hora", mascaraDeHora(e.target.value))} placeholder="14:30" maxLength={5} aria-label="Hora" /></Field>
        </div>
        <p className="t-body-sm t-muted">Opcional: pode deixar em branco.</p>
        <div className="vei-form__linha">
          <Field label="Combustível / carga"><Select value={f.combustivel} onChange={(e) => set("combustivel", e.target.value)} placeholder="Não informado" aria-label="Combustível"><option value="">Não informado</option>{COMBUSTIVEIS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
          <Field label="Limpeza"><Select value={f.limpeza} onChange={(e) => set("limpeza", e.target.value)} placeholder="Não informado" aria-label="Limpeza"><option value="">Não informado</option>{LIMPEZAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
        </div>
        <Field label={momento === "saida" ? "Quem recebeu os carros" : "Quem recebeu de volta"}><Input value={f.recebido} onChange={(e) => set("recebido", e.target.value)} maxLength={120} /></Field>
        <Field label="Observações"><Textarea rows={2} value={f.obs} onChange={(e) => set("obs", e.target.value)} aria-label="Observações" /></Field>
        {falha && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{falha}</p>}
        <Button type="submit" size="lg" block loading={enviando} disabled={carros.length === 0 || !horaOk(f.hora)} data-testid="confirmar-checklist-em-massa">Fazer o checklist de {carros.length} carro{carros.length === 1 ? "" : "s"}</Button>
      </form>
    </Sheet>
  );
}
