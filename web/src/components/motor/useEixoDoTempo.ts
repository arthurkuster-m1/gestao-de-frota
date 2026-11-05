import { useCallback, useState } from "react";
import { hojeLocal, somarDias } from "../../lib/motor/datas";
import { LARGURA_DO_DIA, posicaoDoDia, type Escala } from "../../lib/linhaDoTempo/eixo";

const FOLGA_ESQ = 60, FOLGA_DIR = 120, BORDA = 500;

/**
 * O eixo do tempo "infinito": começa 45 dias atrás e ~18 meses à frente, e CRESCE para os dois lados quando você rola até a borda.
 * É um hook para poder ser COMPARTILHADO: no Planejamento, a tabela de veículos e a de eventos usam o mesmo eixo e rolam juntas.
 */
export function useEixoDoTempo(escalaInicial: Escala = "dia") {
  const [escala, setEscala] = useState<Escala>(escalaInicial);
  const [origem, setOrigem] = useState(() => somarDias(hojeLocal(), -45));
  const [dias, setDias] = useState(560);
  const [scrollX, setScrollX] = useState<number | null>(null);
  const larguraDia = LARGURA_DO_DIA[escala];

  /** Chamado por quem rola (o usuário). Cresce o eixo nas bordas sem o conteúdo pular. */
  const aoRolar = useCallback((x: number, largura: number) => {
    if (x < BORDA) { setOrigem((o) => somarDias(o, -FOLGA_ESQ)); setDias((d) => d + FOLGA_ESQ); setScrollX(x + FOLGA_ESQ * larguraDia); return; }
    if (x + largura > dias * larguraDia - BORDA) setDias((d) => d + FOLGA_DIR);
    setScrollX(x);
  }, [dias, larguraDia]);

  const irPara = useCallback((dia: string, margemDias = 7) => { setScrollX(Math.max(0, posicaoDoDia(dia, origem, larguraDia) - margemDias * larguraDia)); }, [origem, larguraDia]);
  const irParaHoje = useCallback(() => irPara(hojeLocal()), [irPara]);
  /** Trocar a escala volta o olhar para hoje (o pixel de cada dia muda). */
  const mudarEscala = useCallback((e: Escala) => { setEscala(e); setScrollX(Math.max(0, posicaoDoDia(hojeLocal(), origem, LARGURA_DO_DIA[e]) - 7 * LARGURA_DO_DIA[e])); }, [origem]);

  return { origem, dias, escala, larguraDia, scrollX, aoRolar, irPara, irParaHoje, mudarEscala };
}
export type EixoDoTempo = ReturnType<typeof useEixoDoTempo>;
