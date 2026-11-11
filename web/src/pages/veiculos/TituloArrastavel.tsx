import { useRef, useState } from "react";
import { DotsSixVertical } from "@phosphor-icons/react";

const colunaSob = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-col]") ?? null;
const limpar = () => document.querySelectorAll(".mt-titulo-arrasta.is-sobre").forEach((e) => e.classList.remove("is-sobre"));

/**
 * Título de coluna da grade que se arrasta: pegue o título e solte sobre outra coluna para trocar a ordem.
 * Usa eventos de ponteiro (mouse e toque) em vez do "arrastar" do navegador, que a grade bloqueia nos títulos.
 */
export function TituloArrastavel({ id, titulo, aoMover, largura, aoRedimensionar }: { id: string; titulo: string; aoMover: (de: string, para: string) => void; largura?: number; aoRedimensionar?: (id: string, largura: number | null) => void }) {
  const inicio = useRef<{ x: number; y: number; ativo: boolean } | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const terminar = (e: React.PointerEvent<HTMLElement>, soltou: boolean) => {
    const a = inicio.current; inicio.current = null; setArrastando(false); limpar();
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* já solto */ }
    if (soltou && a?.ativo) { const alvo = colunaSob(e.clientX, e.clientY)?.getAttribute("data-col"); if (alvo && alvo !== id) aoMover(id, alvo); }
  };
  return (
    <span className={arrastando ? "mt-titulo-arrasta is-arrastando" : "mt-titulo-arrasta"} title="Arraste para mudar a ordem das colunas" data-testid="titulo-arrastavel" data-col={id}
      onPointerDown={(e) => { if (e.button !== 0) return; inicio.current = { x: e.clientX, y: e.clientY, ativo: false }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => {
        const a = inicio.current; if (!a) return;
        if (!a.ativo && Math.hypot(e.clientX - a.x, e.clientY - a.y) > 6) { a.ativo = true; setArrastando(true); }
        if (a.ativo) { limpar(); const alvo = colunaSob(e.clientX, e.clientY); if (alvo && alvo.getAttribute("data-col") !== id) alvo.classList.add("is-sobre"); }
      }}
      onPointerUp={(e) => terminar(e, true)} onPointerCancel={(e) => terminar(e, false)}>
      <DotsSixVertical size={14} weight="bold" aria-hidden />{titulo}
      {aoRedimensionar && largura !== undefined && (
        <span className="mt-titulo-alca" role="separator" aria-label={`Largura de ${titulo}`} title="Arraste para mudar a largura · duplo clique volta ao padrão" data-testid="alca-coluna"
          onPointerDown={(e) => {
            e.stopPropagation(); e.preventDefault();
            // ouvintes na janela (não no elemento): a grade refaz o cabeçalho a cada largura nova e o elemento some no meio do arrasto
            const x0 = e.clientX; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
            const mover = (ev: PointerEvent) => aoRedimensionar(id, Math.max(80, Math.min(1600, Math.round(largura + ev.clientX - x0))));
            const soltar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); window.removeEventListener("pointercancel", soltar); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
            window.addEventListener("pointermove", mover); window.addEventListener("pointerup", soltar); window.addEventListener("pointercancel", soltar);
          }}
          onPointerMove={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); aoRedimensionar(id, null); }} />
      )}
    </span>
  );
}
