import { Bell } from "@phosphor-icons/react";
import { Button, DateField } from "../../ds";
import { formatarDiaBr } from "../../lib/motor/datas";
import { previsoesQueChegaram, type MarcoPrevisto } from "../../lib/veiculos/previsoes";
import type { Veiculo } from "../../lib/veiculos/tipos";

/**
 * A data prevista chegou (hoje ou antes): o aviso pergunta se realmente aconteceu.
 * "Foi realizado" transforma a previsão na data real (o ciclo de vida avança sozinho); "Mudar data" adia a previsão.
 */
export function PrevisoesQueChegaram({ veiculo, hoje, aoConfirmar, aoAdiar }: {
  veiculo: Pick<Veiculo, "status_ciclo"> & Partial<Veiculo>; hoje: string;
  aoConfirmar: (m: MarcoPrevisto) => Promise<void>; aoAdiar: (m: MarcoPrevisto, nova: string) => Promise<void>;
}) {
  const chegaram = previsoesQueChegaram(veiculo, hoje);
  if (chegaram.length === 0) return null;
  return (
    <div className="mt-previsoes" role="status" data-testid="previsoes-que-chegaram">
      {chegaram.map(({ marco, data }) => (
        <div key={marco.id} className="mt-previsao" data-testid="previsao-que-chegou">
          <span className="mt-previsao__texto"><Bell size={18} weight="fill" aria-hidden /> Previsão de <b>{marco.rotulo}</b> era {data === hoje ? "hoje" : formatarDiaBr(data)}: {marco.id === "liberacao" ? "o carro foi liberado?" : marco.id === "faturamento" ? "o carro foi faturado?" : "o carro foi emplacado?"}</span>
          <span className="mt-previsao__acoes">
            <Button size="sm" onClick={() => void aoConfirmar(marco)} data-testid="previsao-foi-realizado">Foi realizado</Button>
            <span className="mt-previsao__adiar"><span className="t-body-sm t-muted">ou mudar para</span><DateField value="" aria-label={`Nova data prevista de ${marco.rotulo}`} onChange={(e) => { if (e.target.value) void aoAdiar(marco, e.target.value); }} /></span>
          </span>
        </div>
      ))}
    </div>
  );
}
