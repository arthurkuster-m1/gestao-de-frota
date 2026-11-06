import { useEffect, useMemo, useState } from "react";
import { Button, Combobox, DateField, Field, Select, Sheet, Textarea } from "../../ds";
import { vigenciaSugerida } from "../../lib/contratos/regras";
import type { Contrato, ContratoNovo } from "../../lib/contratos/tipos";
import type { Evento, Reserva } from "../../lib/eventos/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";
import "../veiculos/veiculos.css";

type Estado = { evento: string; cliente: string; inicio: string; fim: string; obs: string; marcados: Set<string> };

/** Novo contrato de comodato: um por evento. Escolhe o evento (só os que ainda não têm contrato) e o cliente; vigência e carros vêm das reservas. */
export function NovoContrato({ aberto, onFechar, eventos, eventosComContrato, clientes, reservas, veiculos, onCriar, onCriado }: {
  aberto: boolean; onFechar: () => void; eventos: Evento[]; eventosComContrato: Set<string>; clientes: { id: string; nome: string }[]; reservas: Reserva[]; veiculos: Veiculo[];
  onCriar: (c: ContratoNovo, veiculoIds: string[]) => Promise<Contrato>; onCriado?: (c: Contrato) => void;
}) {
  const [f, setF] = useState<Estado>({ evento: "", cliente: "", inicio: "", fim: "", obs: "", marcados: new Set() });
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (aberto) { setF({ evento: "", cliente: "", inicio: "", fim: "", obs: "", marcados: new Set() }); setFalha(null); } }, [aberto]);
  const set = <K extends keyof Estado>(k: K, v: Estado[K]) => setF((x) => ({ ...x, [k]: v }));
  const livres = useMemo(() => eventos.filter((e) => !eventosComContrato.has(e.id)), [eventos, eventosComContrato]);
  const doEvento = useMemo(() => reservas.filter((r) => r.evento_id === f.evento && r.estado !== "cancelado"), [reservas, f.evento]);
  useEffect(() => { const v = vigenciaSugerida(doEvento); setF((x) => ({ ...x, inicio: v.inicio ?? "", fim: v.fim ?? "", marcados: new Set(doEvento.map((r) => r.veiculo_id)) })); }, [doEvento]);
  const opcoesCliente = useMemo(() => clientes.map((c) => ({ value: c.id, label: c.nome })), [clientes]);
  const carros = doEvento.map((r) => veiculos.find((v) => v.id === r.veiculo_id)).filter((v): v is Veiculo => !!v);
  const alterna = (id: string) => setF((x) => { const n = new Set(x.marcados); if (n.has(id)) n.delete(id); else n.add(id); return { ...x, marcados: n }; });
  const fimRuim = !!f.inicio && !!f.fim && f.fim < f.inicio;

  async function criar() {
    setFalha(null); setEnviando(true);
    try { const c = await onCriar({ evento_id: f.evento, cliente_id: f.cliente, vigencia_inicio: f.inicio || null, vigencia_fim: f.fim || null, observacoes: f.obs.trim() || null }, [...f.marcados]); onFechar(); onCriado?.(c); }
    catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }
  return (
    <Sheet open={aberto} onClose={onFechar} title="Novo contrato">
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void criar(); }} data-testid="form-contrato">
        <Field label="Evento" error={falha}><Select value={f.evento} onChange={(e) => set("evento", e.target.value)} placeholder="Escolher…" aria-label="Evento do contrato"><option value="">Escolher evento…</option>{livres.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</Select></Field>
        {livres.length === 0 && <p className="t-body-sm t-muted">Todos os eventos já têm contrato. O que mudar depois entra como aditivo.</p>}
        <Field label="Cliente"><Combobox value={f.cliente} onChange={(e) => set("cliente", e.target.value)} opcoes={opcoesCliente} placeholder="Buscar cliente…" aria-label="Cliente do contrato" /></Field>
        <div className="vei-form__linha">
          <Field label="Vigência: início"><DateField value={f.inicio} onChange={(e) => set("inicio", e.target.value)} /></Field>
          <Field label="Vigência: fim" error={fimRuim ? "O fim não pode ser antes do início." : null}><DateField value={f.fim} onChange={(e) => set("fim", e.target.value)} /></Field>
        </div>
        <div className="ds-stack" data-testid="carros-do-contrato">
          <span className="t-body" style={{ fontWeight: 600 }}>Carros do contrato</span>
          {!f.evento && <p className="t-body-sm t-muted">Escolha o evento para ver os carros reservados.</p>}
          {f.evento && carros.length === 0 && <p className="t-body-sm t-muted">O evento ainda não tem carros reservados. Dá para incluir depois.</p>}
          <ul className="mt-escolha" role="list">{carros.map((v) => (
            <li key={v.id} className="mt-escolha__item"><label className="mt-escolha__linha"><input type="checkbox" checked={f.marcados.has(v.id)} onChange={() => alterna(v.id)} aria-label={`No contrato: ${v.codigo ?? v.modelo}`} /><span className="mt-escolha__nome">{v.codigo ?? v.modelo.toUpperCase()}</span></label></li>
          ))}</ul>
        </div>
        <Field label="Observações"><Textarea rows={3} value={f.obs} onChange={(e) => set("obs", e.target.value)} aria-label="Observações do contrato" /></Field>
        <Button type="submit" size="lg" block disabled={!f.evento || !f.cliente || fimRuim} loading={enviando} data-testid="criar-contrato">Criar contrato</Button>
      </form>
    </Sheet>
  );
}
