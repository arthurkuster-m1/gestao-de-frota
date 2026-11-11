import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "../cx";

export function Page({ children, center, wide }: { children: ReactNode; center?: boolean; wide?: boolean }) {
  return <main className={cx("ds-page", center && "ds-page--center", wide && "ds-page--wide")}>{children}</main>;
}

export function Header({ lead, actions }: { lead: ReactNode; actions?: ReactNode }) {
  return (
    <header className="ds-header">
      <div className="ds-header__lead">{lead}</div>
      <div className="ds-header__actions">{actions}</div>
    </header>
  );
}

export type NavItem = { id: string; label: string; icon: ReactNode; /** se houver, vira <a> de verdade (abre em nova aba, mostra o destino) */ href?: string };

/** Nav flutuante em pílula azul-marinho. `fixed` por padrão; `static` só para mostrar no guia. */
export function FloatingNav({ items, active, onSelect, fixed = true, className }: { items: NavItem[]; active: string; onSelect: (id: string) => void; fixed?: boolean; className?: string }) {
  return (
    <nav className={cx("ds-nav", !fixed && "ds-nav--static", className)} aria-label="Principal">
      {items.map((i) =>
        i.href ? (
          <a key={i.id} href={i.href} aria-current={i.id === active ? "page" : undefined}
             onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); onSelect(i.id); }}>
            {i.icon}
            {i.label}
          </a>
        ) : (
          <button key={i.id} type="button" aria-current={i.id === active ? "page" : undefined} onClick={() => onSelect(i.id)}>
            {i.icon}
            {i.label}
          </button>
        ),
      )}
    </nav>
  );
}

/** Folha que sobe de baixo no celular e vira modal no desktop. Usa <dialog>: foco preso e Esc nativos. */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; /** Janela larga (formulários de página inteira, como no Notion). */ wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  // Arrastar a barrinha (ou o topo) para baixo fecha a janela, como num "bottom sheet" do celular.
  const [arrasto, setArrasto] = useState<number | null>(null);
  const toque = useRef({ y0: 0, dy: 0 });
  const comecarArrasto = (e: React.PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); toque.current = { y0: e.clientY, dy: 0 }; setArrasto(0); };
  const moverArrasto = (e: React.PointerEvent<HTMLDivElement>) => { if (arrasto === null) return; toque.current.dy = Math.max(0, e.clientY - toque.current.y0); setArrasto(toque.current.dy); };
  const soltarArrasto = () => { if (arrasto === null) return; const fechar = toque.current.dy > 80; setArrasto(null); if (fechar) ref.current?.close(); };
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      // Ao abrir, o navegador focaria o 1º campo (e o teclado do celular subiria sozinho). Apontamos o foco inicial para o corpo da janela:
      // a pessoa escolhe qual campo preencher.
      const corpo = d.querySelector<HTMLElement>(".ds-sheet__body");
      corpo?.setAttribute("tabindex", "-1"); corpo?.setAttribute("autofocus", "");
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);
  // a janela vai para o <body>: uma janela dentro de um <form> (ex.: o endereço dentro do "Novo evento") ficaria com um formulário DENTRO de outro,
  // e salvar o endereço enviava o formulário de fora (a página recarregava e os dados se perdiam). Os eventos do React continuam subindo pela árvore.
  return createPortal(
    <dialog
      ref={ref}
      className={cx("ds-sheet", wide && "ds-sheet--wide")}
      aria-label={title}
      // o evento "close" sobe pela árvore do React: sem este filtro, fechar uma janela aninhada fecharia também a de fora
      onClose={(e) => { if (e.target === ref.current) onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      // "translate" (e não "transform"): a animação de abertura usa transform com fill-mode both e engoliria o deslocamento
      style={arrasto === null ? undefined : { translate: `0 ${arrasto}px`, transition: "none" }}
    >
      <div className="ds-sheet__body">
        <div className="ds-sheet__alca" onPointerDown={comecarArrasto} onPointerMove={moverArrasto} onPointerUp={soltarArrasto} onPointerCancel={soltarArrasto} data-testid="alca-da-janela"><div className="ds-sheet__grip" aria-hidden /></div>
        <h2 className="t-h2">{title}</h2>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
