import { useState } from "react";
import { Trash } from "@phosphor-icons/react";
import { Button, Sheet } from "../../ds";
import { rotuloDoDesejado } from "../../lib/eventos/desejados";
import type { ModeloDesejado } from "../../lib/eventos/tipos";

/**
 * Os pedidos de modelo do evento numa tabela: Status (Reservar em vermelho / Reservado em verde) | Modelo solicitado | Cor | MY | Blindagem.
 * `atendidos`: pedido → carro que o atende (da reserva ligada, ou de um carro do evento que caiba). `previsao`: pedido → carro marcado agora (ainda não reservado).
 * Com `onSelecionar`, clicar numa linha a escolhe como filtro dos carros.
 */
export function TabelaDePedidos({ pedidos, atendidos, previsao, codigoDoCarro, selecionadoId, onSelecionar, onNaoAtendido, onRemover, onErro }: {
  pedidos: readonly ModeloDesejado[]; atendidos: ReadonlyMap<string, string>; previsao?: ReadonlyMap<string, string>; codigoDoCarro: (veiculoId: string) => string;
  selecionadoId?: string | null; onSelecionar?: (id: string | null) => void; onNaoAtendido?: (id: string, naoAtendido: boolean) => Promise<void>; /** Com isto, cada linha ganha a lixeira (pede confirmação antes de excluir o modelo solicitado). */ onRemover?: (id: string) => Promise<void>; onErro?: (m: string) => void;
}) {
  const [excluindo, setExcluindo] = useState<ModeloDesejado | null>(null);
  const [apagando, setApagando] = useState(false);
  if (pedidos.length === 0) return null;
  const muda = (id: string, v: boolean) => void onNaoAtendido?.(id, v).catch((e: Error) => onErro?.(e.message));
  const feitos = pedidos.filter((p) => atendidos.has(p.id) || previsao?.has(p.id)).length;
  return (
    <div className="mt-ped-wrap" data-testid="pedidos-do-evento">
      <table className="mt-ped">
        <caption className="t-body-sm t-muted" style={{ textAlign: "left", paddingBottom: 4 }}>Pedidos do evento · {feitos} de {pedidos.length} atendido{pedidos.length === 1 ? "" : "s"}{onSelecionar ? " · clique num pedido para ver os carros que encaixam" : ""}</caption>
        <thead><tr><th>Status</th><th>Modelo solicitado</th><th>Cor</th><th>MY</th><th>Blindagem</th><th /></tr></thead>
        <tbody>
          {pedidos.map((p) => {
            const carro = atendidos.get(p.id), previsto = previsao?.get(p.id);
            const status = carro ? "reservado" : previsto ? "reservado" : p.nao_atendido ? "indisp" : "reservar";
            return (
              <tr key={p.id} className={[onSelecionar && !carro && !p.nao_atendido ? "is-clicavel" : "", selecionadoId === p.id ? "is-sel" : ""].join(" ").trim()} data-testid="pedido"
                onClick={() => { if (onSelecionar && !carro && !p.nao_atendido) onSelecionar(selecionadoId === p.id ? null : p.id); }}>
                <td><span className={`mt-ped__status is-${status}`}>{status === "reservado" ? (carro ? `Reservado · ${codigoDoCarro(carro)}` : `OK · ${codigoDoCarro(previsto!)}`) : status === "indisp" ? "Indisponível" : "Reservar"}</span></td>
                <td>{[p.modelo, p.versao].filter(Boolean).join(" ")}</td>
                <td>{p.cor || <span className="t-muted">—</span>}</td>
                <td>{p.my || <span className="t-muted">—</span>}</td>
                <td>{p.blindado == null ? <span className="t-muted">—</span> : p.blindado ? "Blindado" : "Sem blindagem"}</td>
                <td className="mt-ped__acao">
                  {onNaoAtendido && !carro && !p.nao_atendido && !previsto && <Button type="button" size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); muda(p.id, true); }} data-testid="nao-disponivel">Não estava disponível</Button>}
                  {onNaoAtendido && p.nao_atendido && <Button type="button" size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); muda(p.id, false); }}>Desfazer</Button>}
                  {onRemover && <Button type="button" size="icon" variant="ghost" aria-label={`Excluir o modelo solicitado ${rotuloDoDesejado(p)}`} title="Excluir modelo solicitado" onClick={(e) => { e.stopPropagation(); setExcluindo(p); }} data-testid="excluir-pedido"><Trash size={18} /></Button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Sheet open={!!excluindo} onClose={() => setExcluindo(null)} title="Excluir modelo solicitado">
        <div className="ds-stack">
          <p className="t-body">Excluir <b>{excluindo ? rotuloDoDesejado(excluindo) : ""}</b> dos modelos solicitados deste evento?{excluindo && (atendidos.has(excluindo.id) || excluindo.reserva_id) ? " O carro que atende esse pedido continua reservado no evento." : ""} Não dá para desfazer.</p>
          <Button variant="danger" size="lg" block loading={apagando} data-testid="confirmar-exclusao-pedido" onClick={() => { if (!excluindo || !onRemover) return; setApagando(true); void onRemover(excluindo.id).then(() => setExcluindo(null)).catch((e: Error) => { onErro?.(e.message); setExcluindo(null); }).finally(() => setApagando(false)); }}>Excluir modelo</Button>
          <Button variant="secondary" size="lg" block onClick={() => setExcluindo(null)}>Cancelar</Button>
        </div>
      </Sheet>
    </div>
  );
}
