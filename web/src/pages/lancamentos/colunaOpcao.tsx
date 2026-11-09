import { CaretDown } from "@phosphor-icons/react";
import type { CellProps, Column } from "react-datasheet-grid";
import { EditorDeCelula } from "../../components/motor/EditorDeCelula";
import { textoParaOpcao } from "../../lib/lancamentos/matriz";
import type { Opcao } from "../../lib/lancamentos/tipos";

type Celula = string | undefined;

/**
 * Coluna da grade com opções fixas: a célula mostra a opção com uma setinha para baixo; clicar abre a lista com todas as opções da categoria.
 * Colar um texto converte o rótulo (ou valor) na opção; texto desconhecido fica como veio e a validação da linha avisa.
 */
export function colunaOpcao(opcoes: readonly Opcao[]): Partial<Column<Celula, unknown, string>> {
  const rotulo = (v: Celula) => opcoes.find((o) => o.value === v)?.label ?? v ?? "";
  function Seletor({ rowData, setRowData, focus, active, stopEditing }: CellProps<Celula, unknown>) {
    if (focus) {
      // a lista de opções do app (a mesma da edição de células), já aberta
      return <EditorDeCelula tipo="opcao" valor={rowData ?? null} opcoes={opcoes} obrigatorio={false} rotulo="Escolher a opção" onConfirmar={(v) => { setRowData(typeof v === "string" && v ? v : undefined); stopEditing(); }} onCancelar={() => stopEditing()} />;
    }
    // um clique numa célula já ativa abre a lista (o mesmo que o duplo clique da grade)
    return (
      <div className="mt-opcao-cel" onClick={(e) => { if (active) e.currentTarget.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); }} data-testid="celula-opcao">
        <span className={rowData ? undefined : "mt-vazio"}>{rowData ? rotulo(rowData) : "Escolher…"}</span><CaretDown size={14} aria-hidden />
      </div>
    );
  }
  return {
    component: Seletor, keepFocus: true,
    copyValue: ({ rowData }) => rotulo(rowData), pasteValue: ({ value }) => textoParaOpcao(value, opcoes) || undefined,
    deleteValue: () => undefined, isCellEmpty: ({ rowData }) => !rowData,
  };
}
