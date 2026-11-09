import { Plus, Trash } from "@phosphor-icons/react";
import { Button, Field, Input } from "../../ds";
import type { ModeloDesejadoNovo } from "../../lib/eventos/tipos";

export type PedidoDeCarro = ModeloDesejadoNovo & { quantidade: number };
export const pedidoVazio = (): PedidoDeCarro => ({ modelo: "", cor: "", my: "", quantidade: 1 });

/** "Modelos desejados": o que o solicitante pediu (modelo obrigatório; versão, cor e MY opcionais) e quantos carros de cada. */
export function ModelosDesejadosForm({ pedidos, onChange }: { pedidos: PedidoDeCarro[]; onChange: (p: PedidoDeCarro[]) => void }) {
  const set = (i: number, patch: Partial<PedidoDeCarro>) => onChange(pedidos.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  return (
    <div className="ds-stack" data-testid="modelos-desejados">
      <div className="ds-row" style={{ justifyContent: "space-between" }}>
        <span className="t-body" style={{ fontWeight: 700 }}>Modelos desejados</span>
        <Button type="button" variant="secondary" size="sm" icon={<Plus size={16} />} onClick={() => onChange([...pedidos, pedidoVazio()])} data-testid="mais-modelo">Adicionar modelo</Button>
      </div>
      {pedidos.length === 0 && <p className="t-body-sm t-muted">Escreva qual carro o evento pede (ex.: 1 S10 TRAILBOSS PITCH 2027). Na hora de reservar, só aparecem os carros que cabem no pedido.</p>}
      {pedidos.map((p, i) => (
        <div key={i} className="mt-pedido" data-testid="pedido-de-carro">
          <Field label="Modelo"><Input value={p.modelo} onChange={(e) => set(i, { modelo: e.target.value })} placeholder="S10 TRAILBOSS PITCH" maxLength={60} aria-label="Modelo desejado" /></Field>
          <Field label="Cor"><Input value={p.cor ?? ""} onChange={(e) => set(i, { cor: e.target.value })} maxLength={40} aria-label="Cor desejada" /></Field>
          <Field label="MY"><Input value={p.my ?? ""} onChange={(e) => set(i, { my: e.target.value })} placeholder="2027" maxLength={10} aria-label="MY desejado" /></Field>
          <Field label="Qtd."><Input type="number" inputMode="numeric" min={1} max={50} value={String(p.quantidade)} onChange={(e) => set(i, { quantidade: Math.max(1, Number(e.target.value) || 1) })} aria-label="Quantidade" /></Field>
          <Button type="button" variant="ghost" size="icon" aria-label="Remover este modelo" onClick={() => onChange(pedidos.filter((_, k) => k !== i))}><Trash size={20} /></Button>
        </div>
      ))}
    </div>
  );
}
