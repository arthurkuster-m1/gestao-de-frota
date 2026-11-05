import { rotuloCiclo, type Veiculo } from "./tipos";

const DATAS: Record<string, string> = { data_pedido: "Pedido recebido em", data_liberacao: "Liberado em", data_faturamento: "Faturado em", data_emplacamento: "Emplacado em", data_devolucao: "Devolvido em" };

/**
 * O que o BANCO mudou sozinho numa edição (ciclo de vida ou data de marco), para avisar a pessoa.
 * `editada`: a coluna que ela mesma mexeu — essa não conta como "automática".
 */
export function avisoDoCicloAutomatico(antes: Veiculo, depois: Veiculo, editada: string): string | null {
  const partes: string[] = [];
  if (editada !== "status_ciclo" && antes.status_ciclo !== depois.status_ciclo) partes.push(`ciclo de vida → ${rotuloCiclo(depois.status_ciclo)}`);
  for (const [col, rotulo] of Object.entries(DATAS)) {
    const a = (antes as unknown as Record<string, string | null>)[col], d = (depois as unknown as Record<string, string | null>)[col];
    if (col !== editada && a !== d && d) partes.push(`${rotulo.toLowerCase()} ${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`);
  }
  return partes.length ? `Atualizei também: ${partes.join(" · ")}` : null;
}
