import { useEffect, useRef, useState } from "react";
import { useToast } from "../../ds";
import type { Movimento } from "./EditorDeCelula";
import { prepararEdicao, valorParaEditor, type ValorEditavel } from "./edicao";
import type { CampoDaTela } from "./tipos";

export type Editando = { id: string; campo: string } | null;
export type OnEditar<T> = (linha: T, campo: CampoDaTela<T>, valor: ValorEditavel) => Promise<void>;

/**
 * A edição no lugar, uma só para Tabela, Cards e Janela do veículo: qual campo está aberto, o que está salvando,
 * o erro a mostrar e o fluxo preparar → gravar → (Tab) abrir o próximo campo.
 */
export function useEdicao<T>(idDe: (l: T) => string, onEditar?: OnEditar<T>) {
  const toast = useToast();
  const [editando, setEditando] = useState<Editando>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Clicar em outra célula com um editor aberto só FECHA o editor (como no Notion): o clique seguinte é que abre o outro campo.
  const abertoNoClique = useRef(false); const editandoRef = useRef<Editando>(null); editandoRef.current = editando;
  useEffect(() => {
    const baixo = (e: MouseEvent) => {
      abertoNoClique.current = editandoRef.current !== null;
      // clicar fora do campo em edição SAI da edição, mesmo se a tela impedir o foco de mudar (selecionar linhas, arrastar…)
      if (editandoRef.current !== null && !(e.target as HTMLElement | null)?.closest?.(".mt-ed, .mt-campo-editando, [popover], dialog")) (document.activeElement as HTMLElement | null)?.blur?.();
    };
    const tecla = () => { abertoNoClique.current = false; };
    document.addEventListener("mousedown", baixo, true); document.addEventListener("keydown", tecla, true);
    return () => { document.removeEventListener("mousedown", baixo, true); document.removeEventListener("keydown", tecla, true); };
  }, []);
  const abrir = (l: T, c: CampoDaTela<T>) => { if (abertoNoClique.current) { abertoNoClique.current = false; return; } setErro(null); setEditando({ id: idDe(l), campo: c.id }); };
  const cancelar = () => setEditando(null);
  const estaAberto = (l: T, campoId: string) => editando?.id === idDe(l) && editando.campo === campoId;
  const estaSalvando = (l: T, campoId: string) => salvando === `${idDe(l)}:${campoId}`;

  /** `navegaveis`: os ids dos campos editáveis na ordem em que a tela os mostra (o Tab anda por ela). */
  async function confirmar(l: T, c: CampoDaTela<T>, bruto: ValorEditavel, mover: Movimento | undefined, navegaveis: readonly string[]) {
    const prep = prepararEdicao(c.tipo, c.edicao!, bruto);
    setEditando(null);
    if (!prep.ok) { setErro(`${c.titulo}: ${prep.erro}`); return; }
    if (prep.valor !== valorParaEditor(c.tipo, c.valorDe(l)) && onEditar) {
      setSalvando(`${idDe(l)}:${c.id}`);
      try { await onEditar(l, c, prep.valor); toast("Salvo"); }
      catch (e) { setErro(`${c.titulo}: ${(e as Error).message}`); setSalvando(null); return; }
      setSalvando(null);
    }
    if (mover) {
      const alvo = navegaveis[navegaveis.indexOf(c.id) + (mover === "proximo" ? 1 : -1)];
      if (alvo) setEditando({ id: idDe(l), campo: alvo });
    }
  }
  /** Valida o que está sendo digitado ANTES de concluir (o editor fica aberto e mostra o erro). */
  const validar = (c: CampoDaTela<T>) => (v: ValorEditavel) => { const r = prepararEdicao(c.tipo, c.edicao!, v); setErro(r.ok ? null : `${c.titulo}: ${r.erro}`); return r.ok ? null : r.erro; };

  return { editando, erro, setErro, abrir, cancelar, estaAberto, estaSalvando, confirmar, validar, editavel: !!onEditar };
}
