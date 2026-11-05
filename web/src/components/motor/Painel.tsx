import { useId, useRef, type ReactNode } from "react";
import { cx } from "../../ds";
import { usePopover } from "../../ds/popover";

/** Botão + painel flutuante (na camada de cima do navegador; no celular a largura se ajusta à tela). */
export function Painel({ rotulo, icone, contagem, ativo, largura = 560, children, testid }: { rotulo: string; icone: ReactNode; contagem?: number; ativo?: boolean; largura?: number; children: ReactNode; testid?: string }) {
  const id = useId();
  const gatilho = useRef<HTMLButtonElement>(null);
  const { ref, aberto, setAberto } = usePopover(gatilho, { largura: Math.min(largura, typeof window === "undefined" ? largura : window.innerWidth - 16), alturaMax: 520 });
  return (
    <>
      <button ref={gatilho} type="button" className={cx("mt-btn", (ativo || (contagem ?? 0) > 0) && "is-on")} aria-expanded={aberto} aria-controls={id} data-testid={testid} onClick={() => setAberto(!aberto)}>
        {icone}<span>{rotulo}</span>{(contagem ?? 0) > 0 && <b className="mt-btn__n">{contagem}</b>}
      </button>
      <div ref={ref} id={id} popover="auto" className="ds-pop mt-painel" onClick={(e) => { if ((e.target as HTMLElement).closest(".mt-item")) setAberto(false); }}>{children}</div>
    </>
  );
}
