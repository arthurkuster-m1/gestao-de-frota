import { Button } from "../../ds";
import type { ModeloDesejado } from "../../lib/eventos/tipos";

/**
 * Os pedidos de modelo do evento numa tabela: Status (Reservar em vermelho / Reservado em verde) | Modelo solicitado | Cor | MY | Blindagem.
 * `atendidos`: pedido → carro que o atende (da reserva ligada, ou de um carro do evento que caiba). `previsao`: pedido → carro marcado agora (ainda não reservado).
 * Com `onSelecionar`, clicar numa linha a escolhe como filtro dos carros.
 */
export function TabelaDePedidos({ pedidos, atendidos, previsao, codigoDoCarro, selecionadoId, onSelecionar, onNaoAtendido, onErro }: {
  pedidos: readonly ModeloDesejado[]; atendidos: ReadonlyMap<string, string>; previsao?: ReadonlyMap<string, string>; codigoDoCarro: (veiculoId: string) => string;
  selecionadoId?: string | null; onSelecionar?: (id: string | null) => void; onNaoAtendido?: (id: string, naoAtendido: boolean) => Promise<void>; onErro?: (m: string) => void;
}) {
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
