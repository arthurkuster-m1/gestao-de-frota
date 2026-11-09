import { Plus, Trash } from "@phosphor-icons/react";
import { CampoDeEndereco } from "../../components/motor/EditorDeEndereco";

/**
 * Uma linha da tabela de Dados do evento que guarda um endereço (origem ou local). Clicar abre a janela do endereço
 * (CEP, rua, colar o endereço inteiro); no fim da linha ficam o "+" (mais um endereço) e a lixeira.
 */
export function LinhaDeEndereco({ titulo, valor, onSalvar, onAdicionar, rotuloAdicionar, onRemover, testid }: {
  titulo: string; valor: string | null; onSalvar: (texto: string | null) => void;
  onAdicionar?: () => void; rotuloAdicionar?: string; onRemover?: () => void; testid?: string;
}) {
  return (
    <div className="mt-ficha__linha mt-ficha__linha--endereco" data-testid={testid}>
      <dt>{titulo}</dt>
      <dd className="mt-linha-end">
        <CampoDeEndereco valor={valor ?? ""} titulo={titulo} placeholder="Clique para informar" onChange={(v) => onSalvar(v.trim() ? v : null)} />
        <span className="mt-linha-end__acoes">
          {onRemover && <button type="button" className="mt-btn mt-btn--icone" aria-label={`Remover ${titulo}`} title="Remover" onClick={onRemover}><Trash size={18} /></button>}
          {onAdicionar && <button type="button" className="mt-btn mt-btn--icone" aria-label={rotuloAdicionar ?? "Adicionar outro"} title={rotuloAdicionar ?? "Adicionar outro"} onClick={onAdicionar} data-testid="adicionar-endereco"><Plus size={18} weight="bold" /></button>}
        </span>
      </dd>
    </div>
  );
}
