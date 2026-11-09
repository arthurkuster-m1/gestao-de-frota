import { useEffect, useState } from "react";
import { Button, DateField, Field, Input, Select, Sheet, Switch, Textarea } from "../../ds";
import { diaDe, horaDe, paraInstante } from "../../lib/checklists/regras";
import { COMBUSTIVEIS, LIMPEZAS, rotuloMomento, type Checklist, type ChecklistNovo, type Momento } from "../../lib/checklists/tipos";
import { hojeLocal } from "../../lib/motor/datas";
import "../veiculos/veiculos.css";

type Estado = { dia: string; hora: string; km: string; combustivel: string; limpeza: string; recebido: string; avarias: boolean; quais: string; obs: string };
/** "1430" → "14:30" (o app não usa o campo de hora nativo do navegador). */
const mascaraDeHora = (t: string) => { const d = t.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d; };
const horaOk = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const horaAgora = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
const inicial = (c: Checklist | null): Estado => c
  ? { dia: diaDe(c.data_hora), hora: horaDe(c.data_hora), km: c.km === null ? "" : String(c.km), combustivel: c.combustivel ?? "", limpeza: c.limpeza ?? "", recebido: c.recebido_por ?? "", avarias: c.teve_avarias, quais: c.avarias ?? "", obs: c.observacoes ?? "" }
  : { dia: hojeLocal(), hora: horaAgora(), km: "", combustivel: "", limpeza: "", recebido: "", avarias: false, quais: "", obs: "" };

/** Checklist de envio ou de retorno de uma reserva: km, combustível, limpeza, quem recebeu, avarias e observações. Sem fotos. */
export function FormularioDeChecklist({ aberto, onFechar, momento, carro, existente, onSalvar }: {
  aberto: boolean; onFechar: () => void; momento: Momento; carro: string; existente: Checklist | null; onSalvar: (c: Omit<ChecklistNovo, "reserva_id" | "momento">) => Promise<void>;
}) {
  const [f, setF] = useState<Estado>(inicial(existente));
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (aberto) { setF(inicial(existente)); setFalha(null); } }, [aberto, existente]);
  const set = <K extends keyof Estado>(k: K, v: Estado[K]) => setF((x) => ({ ...x, [k]: v }));
  const kmNum = f.km.trim() === "" ? null : Number(f.km.replace(/\./g, "").replace(",", "."));
  const kmRuim = kmNum !== null && (!Number.isFinite(kmNum) || kmNum < 0);

  async function salvar() {
    setFalha(null); setEnviando(true);
    try {
      await onSalvar({ data_hora: paraInstante(f.dia || hojeLocal(), f.hora), km: kmNum === null ? null : Math.round(kmNum), combustivel: f.combustivel || null, limpeza: f.limpeza || null, recebido_por: f.recebido.trim() || null,
        teve_avarias: f.avarias, avarias: f.avarias ? f.quais.trim() || null : null, observacoes: f.obs.trim() || null });
      onFechar();
    } catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title={`Checklist de ${rotuloMomento(momento).toLowerCase()}`}>
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void salvar(); }} data-testid="form-checklist">
        <p className="t-body-sm t-muted">Carro: <b>{carro}</b>. {momento === "saida" ? "Ao salvar, a reserva passa para Em uso." : "Ao salvar, a reserva passa para Concluído."}</p>
        <div className="vei-form__linha">
          <Field label="Data"><DateField value={f.dia} onChange={(e) => set("dia", e.target.value)} /></Field>
          <Field label="Hora" error={f.hora && f.hora.length === 5 && !horaOk(f.hora) ? "Hora inválida." : null}><Input inputMode="numeric" value={f.hora} onChange={(e) => set("hora", mascaraDeHora(e.target.value))} placeholder="14:30" maxLength={5} aria-label="Hora do checklist" /></Field>
        </div>
        <Field label="Km do carro" error={kmRuim ? "Digite um número." : falha}><Input inputMode="numeric" value={f.km} onChange={(e) => set("km", e.target.value)} placeholder="Ex.: 12.340" /></Field>
        <div className="vei-form__linha">
          <Field label="Combustível / carga"><Select value={f.combustivel} onChange={(e) => set("combustivel", e.target.value)} placeholder="Escolher…" aria-label="Combustível"><option value="">Não informado</option>{COMBUSTIVEIS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
          <Field label="Limpeza"><Select value={f.limpeza} onChange={(e) => set("limpeza", e.target.value)} placeholder="Escolher…" aria-label="Limpeza"><option value="">Não informado</option>{LIMPEZAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
        </div>
        <Field label={momento === "saida" ? "Quem recebeu o carro" : "Quem recebeu de volta"}><Input value={f.recebido} onChange={(e) => set("recebido", e.target.value)} maxLength={120} /></Field>
        <div className="ds-row" style={{ justifyContent: "space-between" }}><span className="t-body" style={{ fontWeight: 600 }}>Tem avarias?</span><Switch checked={f.avarias} onChange={(v) => set("avarias", v)} label="Tem avarias" /></div>
        {f.avarias && <Field label="Quais avarias"><Textarea rows={3} value={f.quais} onChange={(e) => set("quais", e.target.value)} aria-label="Quais avarias" /></Field>}
        <Field label="Observações"><Textarea rows={3} value={f.obs} onChange={(e) => set("obs", e.target.value)} aria-label="Observações" /></Field>
        <Button type="submit" size="lg" block disabled={kmRuim || !horaOk(f.hora) || (f.avarias && !f.quais.trim())} loading={enviando} data-testid="salvar-checklist">{existente ? "Salvar alterações" : "Salvar checklist"}</Button>
      </form>
    </Sheet>
  );
}
