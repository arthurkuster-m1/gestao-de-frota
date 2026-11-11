import type { Transporte } from "../transportes/tipos";
import type { Veiculo } from "../veiculos/tipos";
import { codigoDoVeiculo, tabelaDeVeiculosParaOutlook } from "./linhasDoEvento";
import type { Evento, EventoLocal, ReservaDoEvento } from "./tipos";

const diaMes = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "XX/XX");
const menosDias = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * O resumo do evento para mandar à transportadora: datas de coleta, entrega e retorno, endereços com contato e a tabela dos carros.
 * Coleta = a data de envio do evento; sem ela, o início da reserva dos carros (o prazo de ida); sem reserva com data, chegada menos os dias de viagem do transporte de ida.
 * Texto puro (tabela com barras, para chat e e-mail em texto) e HTML (tabela azul, para colar no Outlook).
 */
export function textoDoEvento(p: { evento: Evento; reservas: readonly ReservaDoEvento[]; veiculos: readonly Veiculo[]; locais: readonly EventoLocal[]; origensExtras: readonly EventoLocal[]; transportes: readonly Transporte[]; /** evento em que os carros não voltam: o texto não traz a linha de retorno */ semRetorno?: boolean }): { texto: string; html: string } {
  const { evento } = p;
  const abertas = p.reservas.filter((r) => r.evento_id === evento.id && r.estado !== "cancelado");
  const ordenar = <T,>(l: T[]) => l.sort();
  const inicios = ordenar(abertas.map((r) => r.reserva_inicio).filter((x): x is string => !!x));
  const chegadas = ordenar(abertas.map((r) => r.chegada ?? r.reserva_inicio).filter((x): x is string => !!x));
  const retiradas = ordenar(abertas.map((r) => r.retirada ?? r.reserva_fim).filter((x): x is string => !!x));
  const entrega = evento.chegada_prevista ?? chegadas[0] ?? null;
  const retorno = evento.retirada_prevista ?? retiradas.at(-1) ?? null;
  const diasDaIda = Math.max(0, ...p.transportes.filter((t) => t.evento_id === evento.id && t.sentido === "ida").map((t) => t.dias_viagem));
  const coleta = evento.envio_previsto ?? inicios[0] ?? (entrega && diasDaIda > 0 ? menosDias(entrega, diasDaIda) : null);

  const origens = [evento.origem, ...p.origensExtras.filter((l) => l.evento_id === evento.id).sort((a, b) => a.posicao - b.posicao).map((l) => l.endereco)].filter((x): x is string => !!x);
  const locais = p.locais.filter((l) => l.evento_id === evento.id && l.tipo !== "origem").sort((a, b) => a.posicao - b.posicao).map((l) => (l.rotulo ? `${l.rotulo}: ${l.endereco}` : l.endereco));
  const contatoEntrega = evento.contato?.trim() || "a informar", contatoColeta = evento.contato_origem?.trim() || "a informar";
  const enderecos = (lista: string[], vazio: string) => (lista.length ? lista : [vazio]);

  const veiculosPorId = new Map(p.veiculos.map((v) => [v.id, v]));
  const vistos = new Set<string>();
  const carros = abertas.flatMap((r) => { const v = veiculosPorId.get(r.veiculo_id); if (!v || vistos.has(v.id)) return []; vistos.add(v.id); return [v]; })
    .sort((a, b) => codigoDoVeiculo(a).localeCompare(codigoDoVeiculo(b), "pt-BR", { numeric: true }));
  const tabela = tabelaDeVeiculosParaOutlook(carros);
  const linhasMd = carros.map((v) => `| ${[codigoDoVeiculo(v), v.placa ?? "", v.vin ?? "", v.modelo, v.cor ?? "", v.my ?? ""].join(" | ")} |`);
  const tabelaMd = ["| Código | Placa | VIN | Modelo | Cor | MY |", "| --- | --- | --- | --- | --- | --- |", ...linhasMd].join("\n");

  const texto = [
    `EVENTO: ${evento.nome}`,
    "",
    `COLETA DIA ${diaMes(coleta)} (DIA QUE A TRANSPORTADORA DEVE PEGAR O CARRO - DATA DO ENVIO)`,
    "",
    `ENTREGA NO EVENTO DIA ${diaMes(entrega)}`,
    "",
    ...(p.semRetorno ? [] : [`RETORNO DIA ${diaMes(retorno)}`, ""]),
    "",
    "Endereço de Coleta:",
    ...enderecos(origens, "Endereço de coleta a informar").flatMap((e) => [`- ${e}`, `- Contato: ${contatoColeta}`]),
    "",
    "Endereço de Entrega:",
    ...enderecos(locais, "Endereço de entrega a informar").flatMap((e) => [`- ${e}`, `- Contato: ${contatoEntrega}`]),
    "",
    "Segue os dados do(s) Veículo(s)",
    "",
    "Veículos:",
    tabelaMd,
    "",
  ].join("\n");

  const par = (t: string) => `<p style="margin:0 0 8px 0;font-family:Calibri,Arial,sans-serif;font-size:11pt">${t}</p>`;
  const lista = (titulo: string, ends: string[], contato: string) => `${par(`<b>${titulo}:</b>`)}<ul style="margin:0 0 8px 0;font-family:Calibri,Arial,sans-serif;font-size:11pt">${ends.flatMap((e) => [`<li>${esc(e)}</li>`, `<li>Contato: ${esc(contato)}</li>`]).join("")}</ul>`;
  const html = [
    par(`<b>EVENTO:</b> ${esc(evento.nome)}`),
    par(`<b>COLETA DIA ${diaMes(coleta)}</b> (DIA QUE A TRANSPORTADORA DEVE PEGAR O CARRO - DATA DO ENVIO)`),
    par(`<b>ENTREGA NO EVENTO DIA ${diaMes(entrega)}</b>`),
    ...(p.semRetorno ? [] : [par(`<b>RETORNO DIA ${diaMes(retorno)}</b>`)]),
    lista("Endereço de Coleta", enderecos(origens, "Endereço de coleta a informar"), contatoColeta),
    lista("Endereço de Entrega", enderecos(locais, "Endereço de entrega a informar"), contatoEntrega),
    par("Segue os dados do(s) Veículo(s)"),
    par("<b>Veículos:</b>"),
    tabela.html,
  ].join("");
  return { texto, html };
}
