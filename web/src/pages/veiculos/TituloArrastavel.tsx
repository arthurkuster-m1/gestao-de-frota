import { useRef, useState } from "react";
import { DotsSixVertical } from "@phosphor-icons/react";

const colunaSob = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-col]") ?? null;
const limpar = () => document.querySelectorAll(".mt-titulo-arrasta.is-sobre").forEach((e) => e.classList.remove("is-sobre"));

/**
 * Título de coluna da grade que se arrasta: pegue o título e solte sobre outra coluna para trocar a ordem.
 * Usa eventos de ponteiro (mouse e toque) em vez do "arrastar" do navegador, que a grade bloqueia nos títulos.
 */
export function TituloArrastavel({ id, titulo, aoMover }: { id: string; titulo: string; aoMover: (de: string, para: string) => void }) {
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
    </span>
  );
}
