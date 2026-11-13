import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { createContext, useContext } from "react";
import { FileText } from "@phosphor-icons/react";
import type { ResumoDaNota } from "../../lib/anotacoes/paginas";

/** O que o cartão de subpágina precisa saber da árvore (o título e o ícone mudam fora do editor). */
export interface ContextoDasSubpaginas { paginas: readonly ResumoDaNota[]; abrir: (id: string) => void }
export const ContextoSubpaginas = createContext<ContextoDasSubpaginas>({ paginas: [], abrir: () => undefined });

function CartaoDeSubpagina({ node }: NodeViewProps) {
  const { paginas, abrir } = useContext(ContextoSubpaginas);
  const pageId = String(node.attrs.pageId ?? "");
  const pagina = paginas.find((p) => p.id === pageId && !p.deleted_at);
  return (
    <NodeViewWrapper className="an-subpagina-no" data-drag-handle="">
      {pagina ? (
        <button type="button" contentEditable={false} className="an-subpagina" onClick={() => abrir(pageId)}>
          {pagina.icon ? <span style={{ fontSize: 18, lineHeight: 1 }}>{pagina.icon}</span> : <FileText size={18} aria-hidden />}
          <span className="an-subpagina__titulo">{pagina.title || "Sem título"}</span>
        </button>
      ) : null}
    </NodeViewWrapper>
  );
}

/** O cartão de subpágina: um nó do próprio texto (atômico e arrastável), que aponta para a página filha. */
export const Subpagina = Node.create({
  name: "subpagina",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { pageId: { default: "", parseHTML: (el) => el.getAttribute("data-page-id") ?? "", renderHTML: (a) => ({ "data-page-id": a.pageId as string }) } };
  },
  parseHTML() { return [{ tag: 'div[data-type="subpagina"]' }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes({ "data-type": "subpagina" }, HTMLAttributes)]; },
  addNodeView() { return ReactNodeViewRenderer(CartaoDeSubpagina); },
});
