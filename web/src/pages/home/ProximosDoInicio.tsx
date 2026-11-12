import { useMemo } from "react";
import { Truck } from "@phosphor-icons/react";
import { Card } from "../../ds";
import { LinkNoLugar } from "../../app/noLugar";
import { DIAS_DE_ANTECEDENCIA, diasAte, fatosDosEventos } from "../../lib/eventos/automacaoDeStatus";
import { STATUS_EVENTO, type Evento } from "../../lib/eventos/tipos";
import { hojeLocal } from "../../lib/motor/datas";
import { useDadosDeEventos } from "../eventos/useDadosDeEventos";

const etapa = (s: string) => STATUS_EVENTO.findIndex((x) => x.value === s);
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const quando = (n: number) => (n < 0 ? `atrasado ${-n} dia${n === -1 ? "" : "s"}` : n === 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`);
type Item = { e: Evento; data: string; dias: number; feitos: number; carros: number; alerta: boolean };

/** Início: os envios e os retornos que se aproximam (a mesma contagem de 7 dias que muda o status do evento para Solicitar transporte / Solicitar retorno). */
export function ProximosDoInicio() {
  const d = useDadosDeEventos();
  const hoje = hojeLocal();
  const { envios, retornos } = useMemo(() => {
    const fatos = fatosDosEventos({ reservas: [...d.reservas, ...d.reservasSemData], vinculos: d.tr.vinculos, transportes: d.tr.transportes, checklists: d.ck.checklists });
    const envios: Item[] = [], retornos: Item[] = [];
    for (const e of d.eventos ?? []) {
      const f = fatos.get(e.id), et = etapa(e.status), carros = f?.carros ?? 0;
      if (et >= etapa("concluido")) continue;
      if (et < etapa("em_uso") && e.envio_previsto) {
        const dias = diasAte(e.envio_previsto, hoje)!;
        if (dias <= 14 || e.status === "solicitar_transporte") envios.push({ e, data: e.envio_previsto, dias, feitos: f?.comTransporteIda ?? 0, carros, alerta: e.status === "solicitar_transporte" || dias <= DIAS_DE_ANTECEDENCIA });
      }
      if (et >= etapa("em_uso") && e.retirada_prevista && !d.semRetornoDoTipo(e.tipo)) {
        const dias = diasAte(e.retirada_prevista, hoje)!;
        if (dias <= 14 || e.status === "solicitar_retorno" || e.status === "retorno_solicitado") retornos.push({ e, data: e.retirada_prevista, dias, feitos: f?.comTransporteVolta ?? 0, carros, alerta: e.status === "solicitar_retorno" || dias <= DIAS_DE_ANTECEDENCIA });
      }
    }
    const ordem = (a: Item, b: Item) => a.data.localeCompare(b.data);
    return { envios: envios.sort(ordem), retornos: retornos.sort(ordem) };
  }, [d.eventos, d.reservas, d.reservasSemData, d.tr.vinculos, d.ck.checklists, hoje]);

  const bloco = (titulo: string, itens: Item[], vazio: string, rotuloData: string, rotuloTransporte: string, testid: string) => (
    <Card>
      <h2 className="t-h3" style={{ marginBottom: 12 }}><Truck size={20} style={{ verticalAlign: "-4px" }} /> {titulo}</h2>
      {itens.length === 0 ? <p className="t-body-sm t-muted">{vazio}</p> : (
        <ul className="mt-proximos" role="list" data-testid={testid}>
          {itens.map((i) => (
            <li key={i.e.id} className={i.alerta ? "is-alerta" : undefined}>
              <LinkNoLugar to={`/eventos/${i.e.id}`} className="mt-reserva__evento">{i.e.nome}</LinkNoLugar>
              <span className="t-body-sm">{rotuloData} <b>{dm(i.data)}</b> · {quando(i.dias)}</span>
              <span className="t-body-sm t-muted">{rotuloTransporte}: {i.feitos}/{i.carros} carro{i.carros === 1 ? "" : "s"} · {STATUS_EVENTO.find((s) => s.value === i.e.status)?.label}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
  return (
    <>
      {bloco("Próximos envios", envios, "Nenhum envio nos próximos 14 dias.", "Envio", "Transporte de ida", "proximos-envios")}
      {bloco("Próximos retornos", retornos, "Nenhum retorno nos próximos 14 dias.", "Retirada", "Transporte de volta", "proximos-retornos")}
    </>
  );
}
