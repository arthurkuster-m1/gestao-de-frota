import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { useEffect, useRef, useState } from "react";
import { DotsSixVertical } from "@phosphor-icons/react";

/**
 * A ALÇA de arrastar blocos (feita à mão: a extensão oficial puxa o Yjs, que não usamos).
 * Ao passar o mouse, acha o bloco de nível 1 sob o ponteiro e mostra a alça à esquerda dele;
 * ao arrastar, o bloco inteiro vira a seleção e o ProseMirror cuida de soltar no novo lugar.
 */
export function AlcaDeArrastar({ editor, caixa }: { editor: Editor; caixa: React.RefObject<HTMLDivElement | null> }) {
  const [topo, setTopo] = useState<number | null>(null);
  const posicao = useRef<number | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const mover = (e: MouseEvent) => {
      if (!editor.isEditable || !editor.view?.dom) return;
      const dom = editor.view.dom as HTMLElement;
      const r = dom.getBoundingClientRect();
      // x fixo dentro do texto: assim o bloco é achado mesmo com o mouse na margem, onde fica a alça.
      const x = Math.min(Math.max(e.clientX, r.left + 24), r.right - 8);
      const achado = editor.view.posAtCoords({ left: x, top: e.clientY });
      if (!achado) return;
      const $pos = editor.state.doc.resolve(achado.pos);
      const inicio = $pos.depth >= 1 ? $pos.before(1) : achado.inside >= 0 ? achado.inside : null;
      if (inicio == null) return;
      const bloco = editor.view.nodeDOM(inicio) as HTMLElement | null;
      if (!bloco || !bloco.getBoundingClientRect) return;
      const b = bloco.getBoundingClientRect(), c = el.getBoundingClientRect();
      posicao.current = inicio;
      setTopo(b.top - c.top + 2);
    };
    const sair = () => setTopo(null);
    el.addEventListener("mousemove", mover);
    el.addEventListener("mouseleave", sair);
    return () => { el.removeEventListener("mousemove", mover); el.removeEventListener("mouseleave", sair); };
  }, [editor, caixa]);

  function comecouArrasto(e: React.DragEvent<HTMLButtonElement>) {
    const inicio = posicao.current;
    if (inicio == null) return;
    const { view } = editor;
    const selecao = NodeSelection.create(view.state.doc, inicio);
    view.dispatch(view.state.tr.setSelection(selecao));
    view.dragging = { slice: selecao.content(), move: true };
    const bloco = view.nodeDOM(inicio) as HTMLElement | null;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", " ");
    if (bloco) e.dataTransfer.setDragImage(bloco, 0, 0);
  }

  if (topo == null) return null;
  return (
    <button type="button" draggable className="an-alca" style={{ top: topo }} aria-label="Arrastar bloco" title="Arrastar para mover" onDragStart={comecouArrasto} onDragEnd={() => { editor.view.dragging = null; }}>
      <DotsSixVertical size={16} weight="bold" aria-hidden />
    </button>
  );
}
