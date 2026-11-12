import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../ds";
import { planoDeRestauracao, posicaoNoFim } from "../../lib/anotacoes/acoes";
import { apagarDeVez, criarNota, editarNota, listarNotas, moverParaLixeira, restaurarNotas } from "../../lib/anotacoes/dados";
import { idsDaSubarvore, type ResumoDaNota } from "../../lib/anotacoes/paginas";

/**
 * A árvore de páginas: a lista (sem o conteúdo) e as ações — criar, renomear/ícone, mover, lixeira, restaurar e apagar de vez.
 * Tudo vale na tela na hora e volta atrás se o banco recusar. Recarrega ao voltar para a aba.
 */
export function useArvoreDeNotas() {
  const toast = useToast();
  const [notas, setNotas] = useState<ResumoDaNota[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try { setNotas(await listarNotas()); setErro(null); } catch (e) { setErro((e as Error).message); } finally { setCarregado(true); }
  }, []);
  useEffect(() => {
    void carregar();
    const volta = () => { if (document.visibilityState === "visible") void carregar(); };
    document.addEventListener("visibilitychange", volta);
    return () => document.removeEventListener("visibilitychange", volta);
  }, [carregar]);

  const trocar = (n: ResumoDaNota) => setNotas((l) => l.map((x) => (x.id === n.id ? n : x)));
  /** Roda a ação já com a tela mudada; se falhar, volta ao que era e avisa. */
  async function otimista<T>(mudar: (l: ResumoDaNota[]) => ResumoDaNota[], gravar: () => Promise<T>): Promise<T | null> {
    const antes = notas; setNotas(mudar);
    try { return await gravar(); } catch (e) { setNotas(antes); toast((e as Error).message); return null; }
  }

  const criar = async (parentId: string | null, titulo = ""): Promise<ResumoDaNota | null> => {
    try { const n = await criarNota({ parent_id: parentId, title: titulo, position: posicaoNoFim(notas, parentId) }); setNotas((l) => [...l, n]); return n; }
    catch (e) { toast((e as Error).message); return null; }
  };
  const mudar = (id: string, patch: { title?: string; icon?: string | null }) =>
    otimista((l) => l.map((x) => (x.id === id ? { ...x, ...patch, title: patch.title !== undefined ? patch.title.trim() : x.title } : x)), async () => { const atual = notas.find((x) => x.id === id); const n = await editarNota(id, patch, atual ? { title: atual.title, blocks: [] } : undefined); trocar(n); });
  const mover = (id: string, parentId: string | null, position: number) =>
    otimista((l) => l.map((x) => (x.id === id ? { ...x, parent_id: parentId, position } : x)), async () => { trocar(await editarNota(id, { parent_id: parentId, position })); });
  const paraALixeira = async (id: string) => {
    const ids = idsDaSubarvore(notas, id), instante = new Date().toISOString();
    const ok = await otimista((l) => l.map((x) => (ids.includes(x.id) ? { ...x, deleted_at: instante } : x)), () => moverParaLixeira(ids, instante));
    if (ok !== null) toast("Página para a lixeira");
    return ok !== null;
  };
  const restaurar = async (id: string) => {
    const plano = planoDeRestauracao(notas, id); if (plano.ids.length === 0) return;
    await otimista((l) => l.map((x) => (plano.ids.includes(x.id) ? { ...x, deleted_at: null, parent_id: x.id === id && plano.paraARaiz ? null : x.parent_id } : x)), () => restaurarNotas(plano.ids, plano.paraARaiz ? null : undefined).then(() => undefined));
  };
  const apagarParaSempre = (id: string) => otimista((l) => l.filter((x) => !idsDaSubarvore(l, id).includes(x.id)), () => apagarDeVez(id));

  return { notas, carregado, erro, recarregar: carregar, criar, mudar, mover, paraALixeira, restaurar, apagarParaSempre };
}
