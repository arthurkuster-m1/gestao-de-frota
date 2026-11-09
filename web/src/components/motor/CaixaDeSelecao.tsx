import { useEffect, useRef } from "react";

export type Selecao = { ids: ReadonlySet<string>; alternar: (id: string) => void; alternarVarios: (ids: string[], marcar: boolean) => void };

/** Caixinha de seleção de linha (ou "selecionar todas", com o estado do meio). Não dispara o clique da linha. */
export function CaixaDeSelecao({ marcada, parcial, onChange, rotulo }: { marcada: boolean; parcial?: boolean; onChange: (marcar: boolean) => void; rotulo: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!parcial && !marcada; }, [parcial, marcada]);
  return <input ref={ref} type="checkbox" className="mt-chk-sel" checked={marcada} aria-label={rotulo} onChange={(e) => onChange(e.target.checked)} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} data-testid="caixa-selecao" />;
}
