import { useEffect, useRef } from "react";

export type Selecao = { ids: ReadonlySet<string>; alternar: (id: string) => void; alternarVarios: (ids: string[], marcar: boolean) => void; /** troca a seleção inteira (arrastar sobre várias linhas) */ definir: (ids: Set<string>) => void };

/** Logo depois de arrastar sobre várias caixinhas, o "clique" que o navegador ainda dispara não deve desfazer a seleção. */
let ignorarAte = 0;
export const aposArrastoDeSelecao = () => { ignorarAte = Date.now() + 350; };

/** Caixinha de seleção de linha (ou "selecionar todas", com o estado do meio). Não dispara o clique da linha. */
export function CaixaDeSelecao({ marcada, parcial, onChange, rotulo, onPressionar, onShift }: { marcada: boolean; parcial?: boolean; onChange: (marcar: boolean) => void; rotulo: string; /** apertou o mouse na caixinha (para começar a arrastar sobre várias linhas) */ onPressionar?: (e: React.PointerEvent<HTMLInputElement>) => void; /** clique com Shift: seleciona do último marcado até aqui */ onShift?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!parcial && !marcada; }, [parcial, marcada]);
  return <input ref={ref} type="checkbox" className="mt-chk-sel" checked={marcada} aria-label={rotulo} onChange={(e) => { if (Date.now() < ignorarAte) return; onChange(e.target.checked); }} onClick={(e) => { e.stopPropagation(); if (e.shiftKey && onShift) { e.preventDefault(); onShift(); } }} onPointerDown={(e) => { e.stopPropagation(); if (e.button === 0 && !e.shiftKey) onPressionar?.(e); }} onMouseDown={(e) => e.stopPropagation()} data-testid="caixa-selecao" />;
}
