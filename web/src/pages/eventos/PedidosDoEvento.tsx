import { CheckCircle, Lock, WarningCircle } from "@phosphor-icons/react";
import { Button } from "../../ds";
import { rotuloDoDesejado } from "../../lib/eventos/desejados";
import type { ModeloDesejado } from "../../lib/eventos/tipos";

/** O que o evento pediu, com cadeado: aberto (🔒), atendido (✓ + carro) ou "Veículo não estava disponível" (fica registrado). */
export function PedidosDoEvento({ pedidos, codigoDoCarro, onNaoAtendido, onErro }: {
  pedidos: ModeloDesejado[]; codigoDoCarro: (reservaId: string) => string | null; onNaoAtendido: (id: string, naoAtendido: boolean) => Promise<void>; onErro?: (m: string) => void;
}) {
  if (pedidos.length === 0) return null;
  const muda = (id: string, v: boolean) => void onNaoAtendido(id, v).catch((e: Error) => onErro?.(e.message));
  return (
    <div className="mt-pedidos-lista" data-testid="pedidos-do-evento">
      <span className="t-body-sm t-muted">Pedido do evento ({pedidos.filter((p) => p.reserva_id).length} de {pedidos.length} atendido{pedidos.length === 1 ? "" : "s"})</span>
      {pedidos.map((p) => {
        const carro = p.reserva_id ? codigoDoCarro(p.reserva_id) : null;
        return (
          <div key={p.id} className={`mt-pedido-chip${p.reserva_id ? " is-ok" : p.nao_atendido ? " is-falta" : ""}`} data-testid="pedido">
            {p.reserva_id ? <CheckCircle size={18} weight="fill" aria-label="Atendido" /> : p.nao_atendido ? <WarningCircle size={18} weight="fill" aria-label="Não atendido" /> : <Lock size={18} weight="fill" aria-label="Pedido do evento" />}
            <span className="mt-pedido-chip__rotulo">{rotuloDoDesejado(p)}</span>
            {p.reserva_id && <span className="t-body-sm">{carro ? `→ ${carro}` : "atendido"}</span>}
            {p.nao_atendido && <span className="t-body-sm">Veículo não estava disponível</span>}
            {!p.reserva_id && !p.nao_atendido && <Button type="button" size="sm" variant="secondary" onClick={() => muda(p.id, true)} data-testid="nao-disponivel">Não estava disponível</Button>}
            {p.nao_atendido && <Button type="button" size="sm" variant="ghost" onClick={() => muda(p.id, false)}>Desfazer</Button>}
          </div>
        );
      })}
    </div>
  );
}
