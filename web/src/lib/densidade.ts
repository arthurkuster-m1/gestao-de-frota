import { useCallback, useEffect, useState } from "react";

/** Densidade das tabelas: compacta (linhas baixas, como o Notion) ou confortável (linhas altas, mais ar). Fica guardada neste aparelho. */
export type Densidade = "compacta" | "confortavel";
const CHAVE = "frota:densidade";
const EVENTO = "frota-densidade";

export function lerDensidade(): Densidade {
  try { return localStorage.getItem(CHAVE) === "confortavel" ? "confortavel" : "compacta"; } catch { return "compacta"; }
}
export const aplicarDensidade = (d: Densidade) => { if (typeof document !== "undefined") document.documentElement.dataset.densidade = d; };

/** Lê e muda a densidade; todos os lugares que usam o hook acompanham a mudança. */
export function useDensidade() {
  const [densidade, setDensidade] = useState<Densidade>(lerDensidade);
  useEffect(() => { aplicarDensidade(densidade); }, [densidade]);
  useEffect(() => { const ouvir = () => setDensidade(lerDensidade()); window.addEventListener(EVENTO, ouvir); return () => window.removeEventListener(EVENTO, ouvir); }, []);
  const mudar = useCallback((d: Densidade) => {
    try { localStorage.setItem(CHAVE, d); } catch { /* sem armazenamento */ }
    aplicarDensidade(d); setDensidade(d); window.dispatchEvent(new Event(EVENTO));
  }, []);
  return { densidade, mudar, alternar: () => mudar(densidade === "compacta" ? "confortavel" : "compacta") };
}
