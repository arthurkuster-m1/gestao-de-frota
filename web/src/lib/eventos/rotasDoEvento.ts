import { diasDeViagem } from "../transportes/regras";
import type { ResultadoDeDistancia } from "../transportes/rota";
import { valoresEfetivos } from "./linhasDoEvento";
import type { Evento, EventoLocal, ReservaDoEvento } from "./tipos";

export type DatasDoCarro = { reservaId: string; envio: string | null; chegada: string | null; retirada: string | null; retorno: string | null; kmIda: number | null; kmVolta: number | null };
export type DatasDoEvento = { envio: string | null; retorno: string | null; kmIda: number | null; kmVolta: number | null; porCarro: DatasDoCarro[]; avisos: string[] };

const somaDias = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/**
 * Calcula, para o evento e para cada carro, os km da ida (origem → endereço de chegada) e da volta (endereço de chegada → endereço de retorno),
 * os dias de viagem (km ÷ 500 para cima; menos de 200 km = mesmo dia, 0 dias) e as datas:
 *   ENVIO = data de chegada − dias da ida (quando o carro deve sair para chegar a tempo);
 *   RETORNO = data de retirada + dias da volta (quando o carro chega ao endereço de retorno).
 * O evento fica com o envio mais cedo, o retorno mais tarde e os maiores km (a rota mais longa manda).
 */
export async function calcularDatasDoEvento(p: {
  evento: Evento; reservas: readonly ReservaDoEvento[]; locais: readonly EventoLocal[];
  distancia: (origem: string, destino: string) => Promise<ResultadoDeDistancia | null>;
}): Promise<DatasDoEvento> {
  const { evento } = p;
  const locais = p.locais.filter((l) => l.evento_id === evento.id);
  const abertas = p.reservas.filter((r) => r.evento_id === evento.id && r.estado !== "cancelado");
  const avisos: string[] = [];
  const memo = new Map<string, Promise<number | null>>();
  const km = (o: string | null, d: string | null) => {
    if (!o || !d) return Promise.resolve(null);
    const k = `${o}→${d}`; if (!memo.has(k)) memo.set(k, p.distancia(o, d).then((r) => r?.km ?? null)); return memo.get(k)!;
  };
  // sem carros ainda: calcula pelo próprio evento (uma "reserva" vazia herda tudo dele)
  const alvos: (ReservaDoEvento | undefined)[] = abertas.length ? abertas : [undefined];
  const porCarro: DatasDoCarro[] = [];
  let envio: string | null = null, retorno: string | null = null, kmIda: number | null = null, kmVolta: number | null = null;
  let semChegada = false, semRetirada = false, semRota = false, usouManual = false;
  for (const r of alvos) {
    const ef = valoresEfetivos({ reserva: r } as never, evento, locais);
    const medidoIda = await km(ef.origem.valor, ef.enderecoChegada.valor), medidoVolta = await km(ef.enderecoChegada.valor, ef.enderecoRetorno.valor);
    // o mapa não achou a distância: vale o km digitado à mão no evento
    const ki = medidoIda ?? evento.distancia_ida_km ?? null, kv = medidoVolta ?? evento.distancia_volta_km ?? null;
    if (medidoIda === null && ki !== null || medidoVolta === null && kv !== null) usouManual = true;
    if (ki === null || kv === null) semRota = true;
    const dIda = diasDeViagem(ki, "pta"), dVolta = diasDeViagem(kv, "pta");
    const e = ef.chegada.valor ? somaDias(ef.chegada.valor, -dIda) : null, t = ef.retirada.valor ? somaDias(ef.retirada.valor, dVolta) : null;
    if (!ef.chegada.valor) semChegada = true; if (!ef.retirada.valor) semRetirada = true;
    if (r) porCarro.push({ reservaId: r.id, envio: e, chegada: ef.chegada.valor, retirada: ef.retirada.valor, retorno: t, kmIda: ki, kmVolta: kv });
    if (e && (!envio || e < envio)) envio = e; if (t && (!retorno || t > retorno)) retorno = t;
    if (ki !== null && (kmIda === null || ki > kmIda)) kmIda = ki; if (kv !== null && (kmVolta === null || kv > kmVolta)) kmVolta = kv;
  }
  if (usouManual) avisos.push("Não consegui medir alguma rota: usei o km digitado à mão.");
  if (semRota) avisos.push("Faltou origem, endereço de chegada ou de retorno (ou não consegui medir a distância e não há km digitado) em alguma rota: o km dela ficou de fora.");
  if (semChegada) avisos.push("Preencha a data de chegada para gerar o envio.");
  if (semRetirada) avisos.push("Preencha a data de retirada para gerar o retorno.");
  return { envio, retorno, kmIda, kmVolta, porCarro, avisos };
}
