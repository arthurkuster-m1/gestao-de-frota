import { criarEvento, criarLocais, reservarVeiculos } from "./dados";
import type { EventoPronto } from "./importacao";

/**
 * Grava os eventos da importação, um por vez (evento, local e reservas dos carros). Evento histórico (retirada já passou) entra "Concluído",
 * com as reservas dos carros concluídas. Para na primeira falha e devolve o que já foi gravado (o resto continua na tabela).
 */
export async function importarEventos(prontos: readonly EventoPronto[], hoje: string): Promise<{ criados: string[]; falha: { nome: string; erro: string } | null }> {
  const criados: string[] = [];
  for (const e of prontos) {
    try {
      const passado = !!e.retirada && e.retirada < hoje;
      const criado = await criarEvento({ nome: e.nome, tipo: e.tipo, status: e.status ?? (passado ? "concluido" : undefined), solicitante: e.solicitante, contato: e.contato, cliente_id: e.cliente_id, origem: e.origem, comentarios: e.comentarios, chegada_prevista: e.chegada, retirada_prevista: e.retirada });
      if (e.local) await criarLocais(criado.id, [{ rotulo: e.local.rotulo, endereco: e.local.endereco }]);
      if (e.veiculoIds.length && e.chegada && e.retirada) await reservarVeiculos(criado.id, e.veiculoIds, e.chegada, e.retirada, passado ? "concluido" : "reservado", { chegada: e.chegada, retirada: e.retirada });
      criados.push(e.nome);
    } catch (x) { return { criados, falha: { nome: e.nome, erro: (x as Error).message } }; }
  }
  return { criados, falha: null };
}
