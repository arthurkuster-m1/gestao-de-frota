import { criarChecklistsEmMassa } from "../checklists/dados";
import type { ChecklistNovo, Momento } from "../checklists/tipos";
import { criarEvento, reservarSemData, reservarVeiculos } from "../eventos/dados";
import { nomeAutomatico, nomeUnico } from "../eventos/nome";
import type { Evento } from "../eventos/tipos";
import { atualizarCampos } from "./dados";
import type { Resultado } from "./atualizacaoEmMassa";
import { executarEmLote } from "../motor/emLote";

/** Grava os planos (faturamento, emplacamento, devolução) vários carros ao mesmo tempo. Devolve os que foram e a primeira falha, se houve. */
export async function aplicarPlanos(prontos: readonly Resultado[]): Promise<{ feitos: string[]; falha: { codigo: string; erro: string } | null }> {
  const feitos: string[] = []; let falha: { codigo: string; erro: string } | null = null;
  await executarEmLote(prontos.filter((r) => r.veiculo && r.plano).map((r) => ({
    chave: r.veiculo!.id,
    executar: async () => {
      try { await atualizarCampos(r.veiculo!.id, r.plano!.patch); feitos.push(r.veiculo!.id); }
      catch (e) { falha ??= { codigo: r.veiculo!.codigo ?? r.veiculo!.modelo, erro: (e as Error).message }; }
    },
  })), 10);
  return { feitos, falha };
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

/** Registra o checklist (saída ou retorno) de várias reservas de uma vez. Tudo ou nada; o banco põe cada reserva em uso (ou concluída). */
export async function registrarChecklistsEmMassa(reservaIds: string[], momento: Momento, dados: Omit<ChecklistNovo, "reserva_id" | "momento" | "km">) {
  return criarChecklistsEmMassa(reservaIds, momento, dados);
}
