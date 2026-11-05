import { useEffect, useMemo, useState } from "react";
import { Button, Field, Input, Select, Sheet } from "../../ds";
import type { Evento, Reserva } from "../../lib/eventos/tipos";
import { diasDeViagem, paraNumero } from "../../lib/transportes/regras";
import { MODALIDADES, SENTIDOS, type Modalidade, type Sentido, type Transporte, type TransporteNovo } from "../../lib/transportes/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";
import "../veiculos/veiculos.css";

type Estado = { evento: string; sentido: Sentido; modalidade: Modalidade; km: string; referencia: string; transportadora: string; valor: string; marcados: Set<string> };
const vazio = (evento: string): Estado => ({ evento, sentido: "ida", modalidade: "pta", km: "", referencia: "", transportadora: "", valor: "", marcados: new Set() });

/** Novo transporte (uma ida ou uma volta). Escolhe o evento e quais carros vão nele; os dias de viagem saem do km ÷ 500. */
export function NovoTransporte({ aberto, onFechar, eventos, reservas, veiculos, eventoInicial, onCriar, onCriado }: {
  aberto: boolean; onFechar: () => void; eventos: Evento[]; reservas: Reserva[]; veiculos: Veiculo[]; eventoInicial?: string | null;
  onCriar: (t: TransporteNovo, reservaIds: string[]) => Promise<Transporte>; onCriado?: (t: Transporte) => void;
}) {
  const [f, setF] = useState<Estado>(vazio(eventoInicial ?? ""));
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (aberto) { setF(vazio(eventoInicial ?? "")); setFalha(null); } }, [aberto, eventoInicial]);
  const set = <K extends keyof Estado>(k: K, v: Estado[K]) => setF((x) => ({ ...x, [k]: v }));
  const carros = useMemo(() => reservas.filter((r) => r.evento_id === f.evento && r.estado !== "cancelado").map((r) => ({ r, v: veiculos.find((x) => x.id === r.veiculo_id) })).sort((a, b) => (a.v?.codigo ?? "").localeCompare(b.v?.codigo ?? "", "pt-BR", { numeric: true })), [reservas, veiculos, f.evento]);
  useEffect(() => { setF((x) => ({ ...x, marcados: new Set(carros.map((c) => c.r.id)) })); }, [carros]);
  const km = paraNumero(f.km);
  const dias = diasDeViagem(km, f.modalidade);
  const alterna = (id: string) => setF((x) => { const n = new Set(x.marcados); if (n.has(id)) n.delete(id); else n.add(id); return { ...x, marcados: n }; });

  async function criar() {
    setFalha(null); setEnviando(true);
    try {
      const t = await onCriar({ evento_id: f.evento, sentido: f.sentido, modalidade: f.modalidade, distancia_km: km === null ? null : Math.round(km), referencia: f.referencia.trim() || null, transportadora: f.transportadora.trim() || null, valor_planejado: paraNumero(f.valor) }, [...f.marcados]);
      onFechar(); onCriado?.(t);
    } catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title="Novo transporte">
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void criar(); }} data-testid="form-transporte">
        <Field label="Evento" error={falha}><Select value={f.evento} onChange={(e) => set("evento", e.target.value)} placeholder="Escolher…" aria-label="Evento do transporte"><option value="">Escolher evento…</option>{eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</Select></Field>
        <div className="vei-form__linha">
          <Field label="Sentido"><Select value={f.sentido} onChange={(e) => set("sentido", e.target.value as Sentido)}>{SENTIDOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>
          <Field label="Modalidade"><Select value={f.modalidade} onChange={(e) => set("modalidade", e.target.value as Modalidade)}>{MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></Field>
        </div>
        <div className="vei-form__linha">
          <Field label="Distância (km)"><Input inputMode="numeric" value={f.km} onChange={(e) => set("km", e.target.value)} placeholder="Ex.: 3000" /></Field>
          <Field label="Dias de viagem"><Input value={f.modalidade === "retirada" ? "0 (retirada)" : km ? `${dias} (km ÷ 500)` : "—"} readOnly aria-label="Dias de viagem calculados" /></Field>
        </div>
        <div className="vei-form__linha">
          <Field label="Referência (PTA ou orçamento)"><Input value={f.referencia} onChange={(e) => set("referencia", e.target.value)} placeholder="PTAS00666314" maxLength={60} /></Field>
          <Field label="Transportadora"><Input value={f.transportadora} onChange={(e) => set("transportadora", e.target.value)} maxLength={80} /></Field>
        </div>
        <Field label="Valor planejado (R$)"><Input inputMode="decimal" value={f.valor} onChange={(e) => set("valor", e.target.value)} placeholder="1.500,00" /></Field>
        <div className="ds-stack" data-testid="carros-do-transporte">
          <span className="t-body" style={{ fontWeight: 600 }}>Carros neste transporte</span>
          {!f.evento && <p className="t-body-sm t-muted">Escolha o evento para ver os carros reservados.</p>}
          {f.evento && carros.length === 0 && <p className="t-body-sm t-muted">Esse evento ainda não tem carros reservados. Dá para ligar depois.</p>}
          <ul className="mt-escolha" role="list">{carros.map(({ r, v }) => (
            <li key={r.id} className="mt-escolha__item"><label className="mt-escolha__linha"><input type="checkbox" checked={f.marcados.has(r.id)} onChange={() => alterna(r.id)} aria-label={`Levar ${v?.codigo ?? "carro"}`} /><span className="mt-escolha__nome">{v?.codigo ?? v?.modelo.toUpperCase() ?? "?"}</span></label></li>
          ))}</ul>
        </div>
        <Button type="submit" size="lg" block disabled={!f.evento} loading={enviando} data-testid="criar-transporte">Criar transporte</Button>
      </form>
    </Sheet>
  );
}
