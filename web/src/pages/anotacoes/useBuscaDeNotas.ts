import { useEffect, useState } from "react";
import { buscarNotas, type ResultadoDeBusca } from "../../lib/anotacoes/dados";

/** A busca (sem acento): espera 300 ms depois de digitar e procura no título e no texto das páginas. */
export function useBuscaDeNotas(termo: string) {
  const [resultados, setResultados] = useState<ResultadoDeBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => {
    if (termo.trim().length < 2) { setResultados([]); return; }
    let vivo = true; setBuscando(true);
    const t = setTimeout(() => { buscarNotas(termo).then((r) => { if (vivo) setResultados(r); }, () => { if (vivo) setResultados([]); }).finally(() => { if (vivo) setBuscando(false); }); }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [termo]);
  return { resultados, buscando };
}
