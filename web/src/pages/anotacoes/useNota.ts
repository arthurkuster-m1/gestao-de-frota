import { useCallback, useEffect, useRef, useState } from "react";
import { abrirNota, editarNota } from "../../lib/anotacoes/dados";
import type { Documento } from "../../lib/anotacoes/documento";
import type { NotaAberta } from "../../lib/anotacoes/paginas";

const PAUSA_DO_AUTOSALVAR_MS = 900;

/**
 * A página aberta, com o conteúdo, e o autosave: grava 900 ms depois da última mudança e também ao sair da página.
 * Sem rascunho nem "publicar": o que está na tela é a única versão.
 */
export function useNota(id: string | null) {
  const [nota, setNota] = useState<NotaAberta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const pendente = useRef<{ title?: string; blocks?: Documento } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const atual = useRef<NotaAberta | null>(null); atual.current = nota;
  const idAberto = useRef<string | null>(null); idAberto.current = id;

  const gravar = useCallback(async (paraId: string) => {
    const p = pendente.current; if (!p) return;
    pendente.current = null; setSalvando(true);
    try { await editarNota(paraId, p, { title: p.title ?? atual.current?.title ?? "", blocks: p.blocks ?? atual.current?.blocks ?? [] }); setErro(null); }
    catch (e) { const novo = pendente.current as { title?: string; blocks?: Documento } | null; pendente.current = { ...p, ...(novo ?? {}) }; setErro((e as Error).message); }   // volta para a fila: tenta de novo na próxima mudança
    finally { setSalvando(false); }
  }, []);

  useEffect(() => {
    let vivo = true; setNota(null); setErro(null);
    if (!id) return;
    setCarregando(true);
    abrirNota(id).then((n) => { if (vivo) { setNota(n); if (!n) setErro("Página não encontrada."); } }, (e: Error) => { if (vivo) setErro(e.message); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; clearTimeout(timer.current); void gravar(id); };   // trocar de página ou sair grava o que faltava
  }, [id, gravar]);

  const mudar = useCallback((patch: { title?: string; blocks?: Documento }) => {
    if (!idAberto.current) return;
    pendente.current = { ...pendente.current, ...patch };
    setNota((n) => (n ? { ...n, ...(patch.title !== undefined ? { title: patch.title } : {}), ...(patch.blocks ? { blocks: patch.blocks } : {}) } : n));
    clearTimeout(timer.current);
    const paraId = idAberto.current;
    timer.current = setTimeout(() => void gravar(paraId), PAUSA_DO_AUTOSALVAR_MS);
  }, [gravar]);

  return { nota, carregando, erro, salvando, mudar };
}
