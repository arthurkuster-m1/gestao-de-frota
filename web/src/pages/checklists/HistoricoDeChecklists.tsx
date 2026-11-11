import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "../../ds";
import { semAcento } from "../../ds/busca";
import { quandoFoi } from "../../lib/checklists/regras";
import { rotuloMomento, type Checklist } from "../../lib/checklists/tipos";
import "../veiculos/veiculos.css";

type Linha = { id: string; dataHora: string; codigo: string; placa: string; sentido: string; evento: string; recebeu: string; avarias: boolean; busca: string };

/** Histórico de todos os checklists feitos: data, código do carro, sentido (envio/retorno), evento e quem recebeu o carro. Pesquisável por qualquer coluna (e pela placa). */
export function HistoricoDeChecklists({ checklists, carro, evento }: {
  checklists: readonly Checklist[];
  /** reserva → código e placa do carro */ carro: (reservaId: string) => { codigo: string; placa: string };
  /** reserva → nome do evento */ evento: (reservaId: string) => string;
}) {
  const [texto, setTexto] = useState("");
  const linhas = useMemo<Linha[]>(() => [...checklists].sort((a, b) => b.data_hora.localeCompare(a.data_hora)).map((c) => {
    const v = carro(c.reserva_id), sentido = rotuloMomento(c.momento), ev = evento(c.reserva_id), recebeu = c.recebido_por ?? "";
    return { id: c.id, dataHora: c.data_hora, codigo: v.codigo, placa: v.placa, sentido, evento: ev, recebeu, avarias: c.teve_avarias, busca: semAcento([quandoFoi(c.data_hora), v.codigo, v.placa, sentido, ev, recebeu].join(" ")) };
  }), [checklists, carro, evento]);
  const termos = semAcento(texto).split(/\s+/).filter(Boolean);
  const vistas = termos.length ? linhas.filter((l) => termos.every((t) => l.busca.includes(t))) : linhas;

  return (
    <div className="ds-stack" data-testid="historico-checklists">
      <div style={{ position: "relative" }}>
        <MagnifyingGlass size={18} aria-hidden style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pesquisar por data, código, placa, evento ou quem recebeu…" aria-label="Pesquisar no histórico de checklists" style={{ paddingLeft: 38 }} data-testid="busca-historico" />
      </div>
      <p className="t-body-sm t-muted" role="status">{vistas.length === linhas.length ? `${linhas.length} checklist${linhas.length === 1 ? "" : "s"}` : `${vistas.length} de ${linhas.length} checklists`}</p>
      {vistas.length === 0 ? (
        <p className="t-body t-muted" data-testid="historico-vazio">{linhas.length === 0 ? "Nenhum checklist feito ainda." : "Nenhum checklist encontrado para essa busca."}</p>
      ) : (
        <div className="mt-ped-wrap">
          <table className="mt-ped">
            <thead><tr><th>Data</th><th>Código</th><th>Sentido</th><th>Evento</th><th>Quem recebeu</th></tr></thead>
            <tbody>
              {vistas.map((l) => (
                <tr key={l.id} data-testid="linha-historico">
                  <td>{quandoFoi(l.dataHora)}</td>
                  <td><b>{l.codigo}</b></td>
                  <td>{l.sentido}</td>
                  <td>{l.evento}</td>
                  <td>{l.recebeu || <span className="t-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
