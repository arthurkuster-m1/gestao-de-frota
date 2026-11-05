import { useEffect, useState } from "react";
import { Button, Field, Input, Select, Sheet } from "../../ds";
import { paraNumero } from "../../lib/transportes/regras";
import { STATUS_DO_TIPO, TIPOS_PAGAMENTO, type Pagamento, type PagamentoNovo, type TipoPagamento } from "../../lib/transportes/tipos";
import "../veiculos/veiculos.css";

type Estado = { tipo: TipoPagamento; numero: string; status: string; valor: string; departamento: string };
const vazio = (): Estado => ({ tipo: "pta", numero: "", status: "solicitado", valor: "", departamento: "" });

/** Novo pagamento: PTA (Solicitado → Aprovado → Pago) ou NF da TSO (Orçamento recebido → Aprovar NF → Aprovado). */
export function NovoPagamento({ aberto, onFechar, onCriar, onCriado }: { aberto: boolean; onFechar: () => void; onCriar: (p: PagamentoNovo) => Promise<Pagamento>; onCriado?: (p: Pagamento) => void }) {
  const [f, setF] = useState<Estado>(vazio());
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (aberto) { setF(vazio()); setFalha(null); } }, [aberto]);
  const trocarTipo = (tipo: TipoPagamento) => setF((x) => ({ ...x, tipo, status: STATUS_DO_TIPO[tipo][0]!.value }));

  async function criar() {
    setFalha(null); setEnviando(true);
    try { const p = await onCriar({ tipo: f.tipo, numero: f.numero, status: f.status, valor_planejado: paraNumero(f.valor), departamento: f.departamento.trim() || null }); onFechar(); onCriado?.(p); }
    catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }
  return (
    <Sheet open={aberto} onClose={onFechar} title="Novo pagamento">
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void criar(); }} data-testid="form-pagamento">
        <div className="vei-form__linha">
          <Field label="Tipo"><Select value={f.tipo} onChange={(e) => trocarTipo(e.target.value as TipoPagamento)} aria-label="Tipo do pagamento">{TIPOS_PAGAMENTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status do pagamento">{STATUS_DO_TIPO[f.tipo].map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>
        </div>
        <Field label={f.tipo === "pta" ? "Número da PTA" : "Número da NF"} error={falha}><Input value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} placeholder={f.tipo === "pta" ? "PTAS00666314" : "Número da NF"} maxLength={60} autoFocus /></Field>
        <div className="vei-form__linha">
          <Field label="Valor planejado (R$)"><Input inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} placeholder="1.500,00" /></Field>
          <Field label="Departamento responsável"><Input value={f.departamento} onChange={(e) => setF({ ...f, departamento: e.target.value })} maxLength={80} /></Field>
        </div>
        <Button type="submit" size="lg" block disabled={!f.numero.trim()} loading={enviando} data-testid="criar-pagamento">Criar pagamento</Button>
      </form>
    </Sheet>
  );
}
