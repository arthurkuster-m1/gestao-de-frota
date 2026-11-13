import { useCallback, useEffect, useRef, useState } from "react";
import { caminhoDaNota, type ResumoDaNota } from "../../lib/anotacoes/paginas";
import type { useNota } from "./useNota";
import { SeletorDeIcone } from "./SeletorDeIcone";
import { EditorCarregavel } from "./EditorCarregavel";
import { lerDocumento } from "../../lib/anotacoes/documento";

type Props = {
  nota: ResumoDaNota; todas: readonly ResumoDaNota[]; estado: ReturnType<typeof useNota>;
  onSelecionar: (id: string) => void; onTitulo: (titulo: string) => void; onIcone: (icone: string | null) => void;
  onCriarSubpagina: () => Promise<string | null>; onRemoverSubpagina: (id: string) => void; onReordenarSubpaginas: (ids: string[]) => void;
};

/** A página aberta: caminho (migalhas), ícone, título (salva sozinho) e o corpo (editor de blocos, com as subpáginas como cartões). */
export function PaginaDeNota({ nota, todas, estado, onSelecionar, onTitulo, onIcone, onCriarSubpagina, onRemoverSubpagina, onReordenarSubpaginas }: Props) {
  const [titulo, setTitulo] = useState(nota.title);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { setTitulo(nota.title); }, [nota.id]);   // trocar de página troca o título na caixa
  const cursor = useRef<{ inicio: () => void; fim: () => void } | null>(null);
  const pronto = useCallback((c: { inicio: () => void; fim: () => void }) => { cursor.current = c; }, []);
  /** Clicar no branco da página (fora de título, ícone, migalhas e do próprio texto) já leva o cursor para escrever: acima do texto na primeira linha, abaixo no fim. */
  function clicouNoBranco(e: React.MouseEvent<HTMLDivElement>) {
    const alvo = e.target as HTMLElement;
    if (alvo.classList.contains("an-editor") || alvo.closest("button, input, a, nav, .an-editor, .an-slash, .an-barra, [role='menu'], [role='dialog']")) return;   // o próprio editor trata o clique nele
    const corpo = e.currentTarget.querySelector(".an-corpo")?.getBoundingClientRect();
    if (corpo && e.clientY < corpo.top) cursor.current?.inicio(); else cursor.current?.fim();
  }
  const gravar = (t: string) => { clearTimeout(timer.current); if (t.trim() !== nota.title) onTitulo(t); };
  const caminho = caminhoDaNota(todas, nota.id);
  return (
    <div className="an-area" onClick={clicouNoBranco} data-testid="area-da-pagina">
    <article className="an-pagina" data-testid="pagina-de-nota">
      {caminho.length > 1 && (
        <nav className="an-migalhas" aria-label="Caminho da página">
          {caminho.slice(0, -1).map((c) => <button key={c.id} type="button" onClick={() => onSelecionar(c.id)}>{c.icon ?? "📝"} {c.title || "Sem título"}</button>)}
        </nav>
      )}
      <div className="an-pagina__topo"><SeletorDeIcone valor={nota.icon} onMudar={onIcone} tamanho={44} /></div>
      <input className="an-titulo" value={titulo} placeholder="Sem título" maxLength={200} aria-label="Título da página" data-testid="titulo-da-pagina"
        onChange={(e) => { setTitulo(e.target.value); clearTimeout(timer.current); const t = e.target.value; timer.current = setTimeout(() => gravar(t), 700); }}
        onBlur={(e) => gravar(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); gravar((e.target as HTMLInputElement).value); cursor.current ? cursor.current.inicio() : (e.target as HTMLInputElement).blur(); } }} />
      <p className="t-body-sm t-muted an-estado" aria-live="polite">{estado.salvando ? "Salvando…" : estado.erro ? <span style={{ color: "var(--color-error-fg)" }}>{estado.erro}</span> : ""}</p>
      <div className="an-corpo" data-testid="corpo-da-pagina">
        {estado.nota ? (
          <EditorCarregavel key={nota.id} inicial={lerDocumento(estado.nota.blocks)} editavel paginas={todas} paginaId={nota.id}
            aoMudar={(blocks) => estado.mudar({ blocks })} aoAbrir={onSelecionar} aoPronto={pronto}
            aoCriarSubpagina={onCriarSubpagina} aoRemoverSubpagina={onRemoverSubpagina} aoReordenarSubpaginas={onReordenarSubpaginas} />
        ) : estado.erro ? null : <p className="t-body-sm t-muted">Abrindo…</p>}
      </div>
    </article>
    </div>
  );
}
