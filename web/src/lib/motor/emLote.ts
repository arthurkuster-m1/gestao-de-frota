/**
 * Roda gravações em paralelo (até `limite` ao mesmo tempo), mas as da MESMA chave (a mesma linha) uma depois da outra:
 * assim colar uma coluna inteira é rápido e duas colunas do mesmo carro não se atropelam.
 * Cada `executar` deve tratar o próprio erro (aqui um erro não derruba as outras).
 */
export async function executarEmLote(tarefas: readonly { chave: string; executar: () => Promise<void> }[], limite = 6): Promise<void> {
  const filas = new Map<string, (() => Promise<void>)[]>();
  for (const t of tarefas) { const f = filas.get(t.chave); if (f) f.push(t.executar); else filas.set(t.chave, [t.executar]); }
  const lista = [...filas.values()]; let proxima = 0;
  const trabalhador = async () => { while (proxima < lista.length) { const fila = lista[proxima++]!; for (const f of fila) await f(); } };
  await Promise.all(Array.from({ length: Math.min(limite, lista.length) }, trabalhador));
}
