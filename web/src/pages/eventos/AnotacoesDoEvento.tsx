import { useCallback, useEffect, useRef, useState } from "react";
import { abrirAnotacaoDoEvento, gravarAnotacaoDoEvento } from "../../lib/anotacoes/eventos";
import type { Documento } from "../../lib/anotacoes/documento";
import { EditorCarregavel } from "../anotacoes/EditorCarregavel";

const PAUSA_MS = 900;

/**
 * A aba "Anotações" do evento: uma página de planejamento só deste evento (mesmo editor do menu Anotações,
 * sem subpáginas). Salva sozinha 0,9 s depois da última mudança e ao sair.
 */
export function AnotacoesDoEvento({ eventoId }: { eventoId: string }) {
  const [inicial, setInicial] = useState<Documento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const pendente = useRef<Documento | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const carregou = useRef(false);

  const gravar = useCallback(async () => {
    const doc = pendente.current; if (!doc) return;
    pendente.current = null; setSalvando(true);
    try { await gravarAnotacaoDoEvento(eventoId, doc); setErro(null); }
    catch (e) { pendente.current ??= doc; setErro((e as Error).message); }   // volta para a fila: tenta de novo na próxima mudança
    finally { setSalvando(false); }
  }, [eventoId]);

  useEffect(() => {
    let vivo = true; setInicial(null); setErro(null); carregou.current = false;
    abrirAnotacaoDoEvento(eventoId).then((d) => { if (vivo) { carregou.current = true; setInicial(d); } }, (e: Error) => { if (vivo) setErro(e.message); });
    return () => { vivo = false; clearTimeout(timer.current); void gravar(); };   // trocar de evento ou sair grava o que faltava
  }, [eventoId, gravar]);

  const mudar = useCallback((doc: Documento) => {
    if (!carregou.current) return;
    pendente.current = doc;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void gravar(), PAUSA_MS);
  }, [gravar]);

  return (
    <div className="an-evento" data-testid="aba-anotacoes">
      <p className="t-body-sm t-muted" aria-live="polite" style={{ minHeight: 18, margin: "0 0 8px" }}>
        {erro ? <span style={{ color: "var(--color-error-fg)" }}>{erro}</span> : salvando ? "Salvando…" : "Planejamento deste evento. Só aparece aqui dentro."}
      </p>
      {inicial ? (
        <EditorCarregavel key={eventoId} inicial={inicial} editavel paginas={[]} paginaId={eventoId} semSubpaginas
          aoMudar={mudar} aoAbrir={() => undefined} aoCriarSubpagina={async () => null} aoRemoverSubpagina={() => undefined} aoReordenarSubpaginas={() => undefined} />
      ) : erro ? null : <p className="t-body-sm t-muted">Abrindo…</p>}
    </div>
  );
}
