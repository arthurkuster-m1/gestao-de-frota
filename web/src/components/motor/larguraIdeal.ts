/**
 * "Ajustar ao texto" (duplo clique na borda da coluna, como no Excel): a largura em que NENHUM texto da coluna fica cortado, maior ou menor que a atual.
 * Mede cada célula (cabeçalho incluso) numa cópia invisível dentro do mesmo contêiner, com a mesma fonte e o mesmo espaçamento.
 */
export function larguraIdeal(celulas: readonly HTMLElement[], raiz: HTMLElement, minimo = 80, maximo = 900): number {
  const medidor = document.createElement("div");
  medidor.setAttribute("aria-hidden", "true");
  medidor.style.cssText = "position:absolute;left:-99999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none;";
  raiz.appendChild(medidor);   // dentro do contêiner da tabela: os filhos (etiquetas, ícones) herdam as mesmas regras de estilo
  let maior = 0;
  try {
    for (const c of celulas) {
      const cs = getComputedStyle(c);
      const copia = document.createElement("div");
      copia.style.cssText = `display:inline-block;box-sizing:content-box;white-space:nowrap;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};font-style:${cs.fontStyle};letter-spacing:${cs.letterSpacing};text-transform:${cs.textTransform};padding:0 ${cs.paddingRight} 0 ${cs.paddingLeft};`;
      copia.innerHTML = c.innerHTML;
      medidor.appendChild(copia);
      maior = Math.max(maior, copia.getBoundingClientRect().width);
    }
  } finally { raiz.removeChild(medidor); }
  return Math.min(maximo, Math.max(minimo, Math.ceil(maior) + 8));   // +8: folga para o texto não encostar na borda
}
