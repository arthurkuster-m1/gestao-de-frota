import { idsDaSubarvore, type ResumoDaNota } from "./paginas";

/** A posição de uma página nova no FIM das irmãs (mesma mãe, fora da lixeira). */
export function posicaoNoFim(notas: readonly ResumoDaNota[], parentId: string | null): number {
  const irmas = notas.filter((n) => n.parent_id === parentId && !n.deleted_at);
  return irmas.length ? Math.max(...irmas.map((n) => n.position)) + 1 : 1;
}

/**
 * O que volta junto ao restaurar `id`: a página e as que foram para a lixeira NO MESMO INSTANTE que ela (a subárvore apagada de uma vez).
 * Se a mãe continua na lixeira (ou não existe mais), a página volta para a raiz.
 */
export function planoDeRestauracao(notas: readonly ResumoDaNota[], id: string): { ids: string[]; paraARaiz: boolean } {
  const alvo = notas.find((n) => n.id === id);
  if (!alvo?.deleted_at) return { ids: [], paraARaiz: false };
  const junto = new Set(idsDaSubarvore(notas, id).filter((x) => notas.find((n) => n.id === x)?.deleted_at === alvo.deleted_at));
  const mae = alvo.parent_id ? notas.find((n) => n.id === alvo.parent_id) : undefined;
  return { ids: [...junto], paraARaiz: !!alvo.parent_id && (!mae || !!mae.deleted_at) };
}

/** As páginas que foram para a lixeira por conta própria (a raiz de cada exclusão), mais recentes primeiro. */
export function raizesDaLixeira(notas: readonly ResumoDaNota[]): ResumoDaNota[] {
  const porId = new Map(notas.map((n) => [n.id, n]));
  return notas
    .filter((n) => n.deleted_at && !(n.parent_id && porId.get(n.parent_id)?.deleted_at === n.deleted_at))
    .sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? ""));
}
