import { criarEvento, reservarSemData, reservarVeiculos } from "../eventos/dados";
import { nomeAutomatico, nomeUnico } from "../eventos/nome";
import type { Evento } from "../eventos/tipos";
import { atualizarCampos } from "./dados";
import type { Resultado } from "./atualizacaoEmMassa";

/** Grava os planos (faturamento, emplacamento, devolução) carro a carro. Para na primeira falha e devolve os que já foram. */
export async function aplicarPlanos(prontos: readonly Resultado[]): Promise<{ feitos: string[]; falha: { codigo: string; erro: string } | null }> {
  const feitos: string[] = [];
  for (const r of prontos) {
    if (!r.veiculo || !r.plano) continue;
    try { await atualizarCampos(r.veiculo.id, r.plano.patch); feitos.push(r.veiculo.id); }
    catch (e) { return { feitos, falha: { codigo: r.veiculo.codigo ?? r.veiculo.modelo, erro: (e as Error).message } }; }
  }
  return { feitos, falha: null };
}

/** Reserva os carros num evento (criando o evento na hora, se for o caso). Com as datas do evento, reserva no período; sem elas, entra sem data. */
export async function reservarEmMassa(veiculoIds: string[], evento: Evento | { novoNome: string }, nomesExistentes: readonly string[]): Promise<{ evento: Evento; sem_data: boolean }> {
  let e: Evento;
  if ("novoNome" in evento) {
    const nome = evento.novoNome.trim() || nomeUnico(nomeAutomatico(null, null), nomesExistentes);
    e = await criarEvento({ nome });
  } else e = evento;
  if (e.chegada_prevista && e.retirada_prevista) { await reservarVeiculos(e.id, veiculoIds, e.chegada_prevista, e.retirada_prevista, "reservado", { chegada: e.chegada_prevista, retirada: e.retirada_prevista }); return { evento: e, sem_data: false }; }
  await reservarSemData(e.id, veiculoIds);
  return { evento: e, sem_data: true };
}
