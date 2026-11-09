const CHAVE = "frota:largura-painel";
const MIN = 420;

function aplicar(px: number | null) {
  const el = document.documentElement;
  if (px === null) el.style.removeProperty("--largura-painel"); else el.style.setProperty("--largura-painel", `${px}px`);
}
try { const v = Number(localStorage.getItem(CHAVE)); if (Number.isFinite(v) && v >= MIN) aplicar(v); } catch { /* sem armazenamento */ }

/**
 * A borda esquerda do painel lateral: clique e arraste para esticar ou diminuir (vale para todos os painéis e fica guardado neste aparelho).
 * Duplo clique volta ao tamanho padrão.
 */
export function AlcaDoPainel() {
  const comecar = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const alvo = e.currentTarget; alvo.setPointerCapture(e.pointerId);
    const mover = (ev: PointerEvent) => aplicar(Math.round(Math.min(window.innerWidth, Math.max(MIN, window.innerWidth - ev.clientX))));
    const soltar = () => {
      alvo.removeEventListener("pointermove", mover); alvo.removeEventListener("pointerup", soltar);
      const atual = parseInt(document.documentElement.style.getPropertyValue("--largura-painel"), 10);
      try { if (Number.isFinite(atual)) localStorage.setItem(CHAVE, String(atual)); } catch { /* sem armazenamento */ }
    };
    alvo.addEventListener("pointermove", mover); alvo.addEventListener("pointerup", soltar);
  };
  const padrao = () => { aplicar(null); try { localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ } };
  return <div className="mt-janela__alca" role="separator" aria-orientation="vertical" aria-label="Arraste para mudar a largura do painel" title="Arraste para mudar a largura (duplo clique: padrão)" onPointerDown={comecar} onDoubleClick={padrao} data-testid="alca-do-painel" />;
}
