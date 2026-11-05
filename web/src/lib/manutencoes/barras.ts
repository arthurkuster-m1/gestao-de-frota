import type { Barra } from "../linhaDoTempo/tipos";
import { fimDaBarra } from "./regras";
import type { Manutencao } from "./tipos";

/** As barras de manutenção de UM carro: amarela enquanto está na oficina, verde quando ficou pronta. Arrastar muda as datas. */
export function barrasDeManutencao(ms: readonly Manutencao[], hoje: string): Barra[] {
  return ms.map((m) => ({
    id: m.id, inicio: m.data_inicio, fim: fimDaBarra(m, hoje), rotulo: `Manutenção · ${m.nome}`,
    tom: m.status === "pronto" ? "success" : m.bloqueia_uso ? "warning" : "info", movel: true, esticavel: true, dados: { manutencaoId: m.id },
  }));
}
/** A barra de uma manutenção na tela de Manutenções (uma por linha). */
export const barraDaManutencao = (m: Manutencao, hoje: string): Barra[] => barrasDeManutencao([m], hoje);
export const ehBarraDeManutencao = (b: Barra) => !!(b.dados as { manutencaoId?: string } | undefined)?.manutencaoId;
