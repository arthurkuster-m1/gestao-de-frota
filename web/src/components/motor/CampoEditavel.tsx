import { EditorDeCelula } from "./EditorDeCelula";
import { valorParaEditor } from "./edicao";
import { formatar } from "./formatar";
import type { CampoDaTela } from "./tipos";
import type { useEdicao } from "./useEdicao";

/** O valor de um campo em card ou janela: editor no lugar quando aberto; senão o valor (clicável se for editável). */
export function CampoEditavel<T>({ linha, campo, ed, navegaveis }: { linha: T; campo: CampoDaTela<T>; ed: ReturnType<typeof useEdicao<T>>; navegaveis: readonly string[] }) {
  if (ed.estaAberto(linha, campo.id) && campo.edicao) {
    return (
      <div className="mt-campo-editando" data-testid="campo-editando">
        <EditorDeCelula campoId={campo.id} tipo={campo.tipo} valor={valorParaEditor(campo.tipo, campo.valorDe(linha))} opcoes={campo.opcoes} obrigatorio={campo.edicao.obrigatorio} edicao={campo.edicao} rotulo={campo.titulo}
          validar={ed.validar(campo)} onConfirmar={(v, mover) => void ed.confirmar(linha, campo, v, mover, navegaveis)} onCancelar={ed.cancelar} />
      </div>
    );
  }
  if (!ed.editavel || !campo.edicao) return <span className="mt-valor">{formatar(campo, linha)}</span>;
  return (
    <button type="button" className={`mt-valor mt-valor--edita${ed.estaSalvando(linha, campo.id) ? " is-salvando" : ""}`} data-campo={campo.id} data-editavel
      onClick={(e) => { e.stopPropagation(); if (campo.tipo === "caixa") void ed.confirmar(linha, campo, !(campo.valorDe(linha) === true), undefined, navegaveis); else ed.abrir(linha, campo); }}>
      {formatar(campo, linha)}
    </button>
  );
}
