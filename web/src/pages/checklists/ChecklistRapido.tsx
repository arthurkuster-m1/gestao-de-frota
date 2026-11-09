import { useEffect, useState } from "react";
import { Button, DateField, Field, Input, Select, Switch, Textarea } from "../../ds";
import { paraInstante } from "../../lib/checklists/regras";
import { COMBUSTIVEIS, LIMPEZAS, type Checklist, type ChecklistNovo, type Momento } from "../../lib/checklists/tipos";
import { hojeLocal } from "../../lib/motor/datas";

const mascaraDeHora = (t: string) => { const d = t.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d; };
const horaOk = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const horaAgora = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

/** O formulário do checklist na própria página (sem janela): data e hora já vêm de agora; o resto é opcional, menos "avarias → quais". */
export function ChecklistRapido({ momento, recebidoPor, existente, onSalvar, rotuloDoBotao }: {
  momento: Momento; recebidoPor?: string; existente: Checklist | null; onSalvar: (c: Omit<ChecklistNovo, "reserva_id" | "momento">) => Promise<void>; rotuloDoBotao: string;
}) {
  const [f, setF] = useState({ dia: hojeLocal(), hora: horaAgora(), km: "", combustivel: "", limpeza: "", recebido: recebidoPor ?? "", avarias: false, quais: "", obs: "" });
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { setF((x) => ({ ...x, recebido: x.recebido || recebidoPor || "" })); }, [recebidoPor]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const kmNum = f.km.trim() === "" ? null : Number(f.km.replace(/\./g, "").replace(",", "."));
  const kmRuim = kmNum !== null && (!Number.isFinite(kmNum) || kmNum < 0);

  async function salvar() {
    setFalha(null); setEnviando(true);
    try {
      await onSalvar({ data_hora: paraInstante(f.dia || hojeLocal(), f.hora), km: kmNum === null ? null : Math.round(kmNum), combustivel: f.combustivel || null, limpeza: f.limpeza || null, recebido_por: f.recebido.trim() || null,
        teve_avarias: f.avarias, avarias: f.avarias ? f.quais.trim() || null : null, observacoes: f.obs.trim() || null });
    } catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }
  return (
    <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void salvar(); }} data-testid="checklist-rapido">
      {existente && <p className="t-body-sm" role="note" style={{ color: "var(--color-warning-fg)" }}>Este carro já tem o checklist de {momento === "saida" ? "envio" : "retorno"} neste evento. Abra a ficha do carro para editar.</p>}
      <div className="vei-form__linha">
        <Field label="Data"><DateField value={f.dia} onChange={(e) => set("dia", e.target.value)} /></Field>
        <Field label="Hora" error={f.hora.length === 5 && !horaOk(f.hora) ? "Hora inválida." : null}><Input inputMode="numeric" value={f.hora} onChange={(e) => set("hora", mascaraDeHora(e.target.value))} placeholder="14:30" maxLength={5} aria-label="Hora" /></Field>
      </div>
      <Field label="Km do carro" error={kmRuim ? "Digite um número." : null}><Input inputMode="numeric" value={f.km} onChange={(e) => set("km", e.target.value)} placeholder="Ex.: 12.340 (pode deixar em branco)" /></Field>
      <div className="vei-form__linha">
        <Field label="Combustível / carga"><Select value={f.combustivel} onChange={(e) => set("combustivel", e.target.value)} aria-label="Combustível"><option value="">Não informado</option>{COMBUSTIVEIS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
        <Field label="Limpeza"><Select value={f.limpeza} onChange={(e) => set("limpeza", e.target.value)} aria-label="Limpeza"><option value="">Não informado</option>{LIMPEZAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
      </div>
      <Field label={momento === "saida" ? "Quem recebeu o carro" : "Quem recebeu de volta"}><Input value={f.recebido} onChange={(e) => set("recebido", e.target.value)} maxLength={120} /></Field>
      <div className="ds-row" style={{ justifyContent: "space-between" }}><span className="t-body" style={{ fontWeight: 600 }}>Tem avarias?</span><Switch checked={f.avarias} onChange={(v) => set("avarias", v)} label="Tem avarias" /></div>
      {f.avarias && <Field label="Quais avarias"><Textarea rows={3} value={f.quais} onChange={(e) => set("quais", e.target.value)} aria-label="Quais avarias" /></Field>}
      <Field label="Observações"><Textarea rows={2} value={f.obs} onChange={(e) => set("obs", e.target.value)} aria-label="Observações" /></Field>
      {falha && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{falha}</p>}
      <Button type="submit" size="lg" block loading={enviando} disabled={!!existente || kmRuim || !horaOk(f.hora) || (f.avarias && !f.quais.trim())} data-testid="salvar-checklist-rapido">{rotuloDoBotao}</Button>
    </form>
  );
}
