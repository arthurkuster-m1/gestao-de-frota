import { Extension, ReactRenderer, type Editor, type Range } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { dobrar } from "../../lib/anotacoes/busca";

/** Um item do menu "/": o que a pessoa vê e o comando que roda (já sem o "/digitado"). */
export interface ItemDoMenu {
  titulo: string;
  descricao: string;
  /** Palavras extras para achar o item (sem acento). */
  apelidos: string[];
  executar: (editor: Editor, intervalo: Range) => void | Promise<void>;
}

export interface ListaRef { aoTeclar: (e: KeyboardEvent) => boolean }
interface ListaProps { items: ItemDoMenu[]; command: (item: ItemDoMenu) => void }

/** A lista do menu: setas, Enter ou Tab escolhem. */
export const ListaDoMenu = forwardRef<ListaRef, ListaProps>(function ListaDoMenu({ items, command }, ref) {
  const [indice, setIndice] = useState(0);
  useEffect(() => setIndice(0), [items]);
  useEffect(() => { document.querySelector(".an-slash__item.is-ativo")?.scrollIntoView({ block: "nearest" }); }, [indice]);
  useImperativeHandle(ref, () => ({
    aoTeclar(e) {
      if (!items.length) return false;
      if (e.key === "ArrowDown") { setIndice((i) => (i + 1) % items.length); return true; }
      if (e.key === "ArrowUp") { setIndice((i) => (i - 1 + items.length) % items.length); return true; }
      if (e.key === "Enter" || e.key === "Tab") { const it = items[indice]; if (it) command(it); return true; }
      return false;
    },
  }), [items, indice, command]);
  if (!items.length) return <div className="an-slash__vazio">Nenhum bloco encontrado</div>;
  return (
    <ul role="listbox" aria-label="Blocos" className="an-slash__lista">
      {items.map((it, i) => (
        <li key={it.titulo} role="option" aria-selected={i === indice}>
          <button type="button" className={`an-slash__item${i === indice ? " is-ativo" : ""}`} onMouseEnter={() => setIndice(i)} onMouseDown={(e) => { e.preventDefault(); command(it); }}>
            <span className="an-slash__titulo">{it.titulo}</span><span className="an-slash__desc">{it.descricao}</span>
          </button>
        </li>
      ))}
    </ul>
  );
});

/** Sem acento e sem maiúsculas: "titulo" acha "Título". */
export function filtrarItens(itens: ItemDoMenu[], consulta: string): ItemDoMenu[] {
  const q = dobrar(consulta.trim());
  if (!q) return itens;
  return itens.filter((i) => dobrar(`${i.titulo} ${i.apelidos.join(" ")}`).includes(q));
}

/** Põe o menu em position:fixed junto do cursor; se faltar espaço embaixo, abre para cima. */
function posicionar(el: HTMLElement, rect: (() => DOMRect | null) | null | undefined) {
  const r = rect?.(); if (!r) return;
  el.style.position = "fixed";
  const altura = el.offsetHeight, largura = el.offsetWidth;
  const embaixo = r.bottom + 6, cabe = embaixo + altura <= window.innerHeight - 8;
  el.style.top = `${cabe ? embaixo : Math.max(8, r.top - altura - 6)}px`;
  el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - largura - 8))}px`;
}

/** A extensão do "/": abre o menu de blocos. `allowSpaces: false` fecha o menu em frases como "1 / 2 pessoas". */
export function criarMenuSlash(itens: (editor: Editor) => ItemDoMenu[]) {
  return Extension.create({
    name: "menuSlash",
    addProseMirrorPlugins() {
      return [
        Suggestion<ItemDoMenu>({
          editor: this.editor,
          char: "/",
          allowSpaces: false,
          startOfLine: false,
          items: ({ query, editor }) => filtrarItens(itens(editor), query),
          command: ({ editor, range, props }) => { void props.executar(editor, range); },
          render: () => {
            let r: ReactRenderer<ListaRef, ListaProps> | null = null;
            return {
              onStart: (p) => {
                r = new ReactRenderer(ListaDoMenu, { props: p, editor: p.editor });
                r.element.classList.add("an-slash");
                document.body.appendChild(r.element);
                requestAnimationFrame(() => r && posicionar(r.element, p.clientRect));
              },
              onUpdate: (p) => { r?.updateProps(p); requestAnimationFrame(() => r && posicionar(r.element, p.clientRect)); },
              onKeyDown: (p) => r?.ref?.aoTeclar(p.event) ?? false,
              onExit: () => { r?.element.remove(); r?.destroy(); r = null; },
            };
          },
        }),
      ];
    },
  });
}
