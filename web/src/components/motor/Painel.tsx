import { useId, useRef, type ReactNode, type RefObject } from "react";
import { cx } from "../../ds";
import { usePopover } from "../../ds/popover";

/**
 * Botão + painel flutuante (na camada de cima do navegador; no celular a largura se ajusta à tela).
 * `soIcone`: botão pequeno só com o ícone, cinza quando não há nada configurado e azul quando há (como no Notion).
 */
export function Painel({ rotulo, icone, contagem, ativo, largura = 560, children, testid, soIcone, gatilhoRef }: {
  rotulo: string; icone: ReactNode; contagem?: number; ativo?: boolean; largura?: number; children: ReactNode; testid?: string; soIcone?: boolean; gatilhoRef?: RefObject<HTMLButtonElement | null>;
}) {
  const id = useId();
  const propria = useRef<HTMLButtonElement>(null);
  const gatilho = gatilhoRef ?? propria;
  const { ref, aberto, setAberto } = usePopover(gatilho, { largura: Math.min(largura, typeof window === "undefined" ? largura : window.innerWidth - 16), alturaMax: 520 });
  const ligado = ativo || (contagem ?? 0) > 0;
  const nome = soIcone && (contagem ?? 0) > 0 ? `${rotulo} (${contagem})` : rotulo;
  return (
    <>
      <button ref={gatilho} type="button" className={cx("mt-btn", soIcone && "mt-btn--icone", ligado && "is-on")} aria-expanded={aberto} aria-controls={id} aria-label={soIcone ? nome : undefined} title={soIcone ? nome : undefined} data-testid={testid} onClick={() => setAberto(!aberto)}>
        {icone}{!soIcone && <span>{rotulo}</span>}{!soIcone && (contagem ?? 0) > 0 && <b className="mt-btn__n">{contagem}</b>}
      </button>
      <div ref={ref} id={id} popover="auto" className="ds-pop mt-painel" onClick={(e) => { if ((e.target as HTMLElement).closest(".mt-item")) setAberto(false); }}>{children}</div>
    </>
  );
}
