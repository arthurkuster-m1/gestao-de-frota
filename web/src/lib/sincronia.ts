import { useSyncExternalStore } from "react";

/**
 * Sincronia entre telas: qualquer gravação no banco (feita em QUALQUER painel ou página) sobe a "versão dos dados", e todas as telas
 * abertas (a de trás e o painel por cima) recarregam as listas na hora. Agrupa gravações seguidas num só recarregamento.
 */
let versao = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const ouvintes = new Set<() => void>();

export function avisarMudanca() {
  clearTimeout(timer);
  timer = setTimeout(() => { versao++; ouvintes.forEach((f) => f()); }, 120);
}
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
/** Um número que muda a cada gravação: coloque nas dependências do efeito que carrega a lista. */
export const useVersaoDosDados = () => useSyncExternalStore(assinar, () => versao);
