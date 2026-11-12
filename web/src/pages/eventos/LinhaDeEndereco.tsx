import { Plus, Trash } from "@phosphor-icons/react";
import { BotaoCopiar } from "../../components/motor/BotaoCopiar";
import { CampoDeEndereco, type EnderecoConhecido } from "../../components/motor/EditorDeEndereco";

/**
 * Uma linha da tabela de Dados do evento que guarda um endereço (origem ou local). Clicar abre a janela do endereço
 * (CEP, rua, colar o endereço inteiro); no fim da linha ficam o "+" (mais um endereço) e a lixeira.
 */
export function LinhaDeEndereco({ titulo, valor, onSalvar, onAdicionar, rotuloAdicionar, onRemover, testid, sugestao, placeholder, comNome, nome, conhecidos }: {
  titulo: string; valor: string | null; onSalvar: (texto: string | null, nome?: string | null) => void; /** com nome do local e busca nos endereços já cadastrados */ comNome?: boolean; nome?: string | null; conhecidos?: readonly EnderecoConhecido[];
  onAdicionar?: () => void; rotuloAdicionar?: string; onRemover?: () => void; testid?: string; sugestao?: string; placeholder?: string;
}) {
  return (
    <div className="mt-ficha__linha mt-ficha__linha--endereco" data-testid={testid}>
      <dt>{titulo}</dt>
      <dd className="mt-linha-end">
        <CampoDeEndereco valor={valor ?? ""} titulo={titulo} placeholder={placeholder ?? "Clique para informar"} sugestao={sugestao} comNome={comNome} nome={nome} conhecidos={conhecidos} onChange={(v, n) => onSalvar(v.trim() ? v : null, n)} />
        <span className="mt-linha-end__acoes">
          <BotaoCopiar texto={valor} rotulo={`Copiar ${titulo.toLowerCase()}`} />
          {onRemover && <button type="button" className="mt-btn mt-btn--icone" aria-label={`Remover ${titulo}`} title="Remover" onClick={onRemover}><Trash size={18} /></button>}
          {onAdicionar && <button type="button" className="mt-btn mt-btn--icone" aria-label={rotuloAdicionar ?? "Adicionar outro"} title={rotuloAdicionar ?? "Adicionar outro"} onClick={onAdicionar} data-testid="adicionar-endereco"><Plus size={18} weight="bold" /></button>}
        </span>
      </dd>
    </div>
  );
}
