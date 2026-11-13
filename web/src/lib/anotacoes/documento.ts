import { z } from "zod";
import { converterBlocos, ehFormatoAntigo } from "./legado";
import { sanear, type NoTiptap } from "./sanear";

/**
 * O DOCUMENTO de uma página de anotação: o `content` do documento do Tiptap (lista de nós, sem ids),
 * guardado na coluna `blocks` (jsonb). O servidor só garante o formato mínimo (cada nó tem `type`),
 * o teto de nós na raiz e, pelo banco, o teto de tamanho.
 *
 * Páginas gravadas no formato antigo (blocos com `id`) são convertidas ao LER (`legado.ts`) e só
 * são regravadas se a pessoa editar. Páginas do formato mais antigo ainda (Estratégia) abrem em branco.
 */
export const MAXIMO_DE_BLOCOS_NA_RAIZ = 3000;
export type { NoTiptap };
export type Documento = NoTiptap[];

export const documentoSchema = z.array(z.object({ type: z.string().min(1).max(40) }).passthrough()).max(MAXIMO_DE_BLOCOS_NA_RAIZ);

/** O que veio do banco, convertido (se antigo) e limpo: só o que o editor entende. */
export function lerDocumento(valor: unknown): Documento {
  if (!Array.isArray(valor)) return [];
  const base = ehFormatoAntigo(valor) ? converterBlocos(valor) : valor;
  return sanear(base, MAXIMO_DE_BLOCOS_NA_RAIZ);
}

/** Os ids das subpáginas citadas no documento, na ordem em que aparecem (em qualquer nível). */
export function cartoesDoDocumento(documento: readonly unknown[]): string[] {
  const ids: string[] = [];
  const anda = (nos: readonly unknown[]) => {
    for (const n of nos) {
      if (typeof n !== "object" || n === null) continue;
      const no = n as { type?: unknown; attrs?: { pageId?: unknown }; content?: unknown };
      if (no.type === "subpagina" && typeof no.attrs?.pageId === "string") ids.push(no.attrs.pageId);
      if (Array.isArray(no.content)) anda(no.content);
    }
  };
  anda(documento);
  return ids;
}

/**
 * Ajusta as subpáginas do documento ao que existe na árvore: tira cartão de página que não é mais
 * filha daqui (movida, apagada) e cartão repetido, e acrescenta no fim um cartão para cada filha
 * que ainda não tem. `filhas` já vem na ordem da árvore.
 */
export function ajustarCartoes(documento: Documento, filhas: readonly string[]): Documento {
  const validas = new Set(filhas);
  const vistos = new Set<string>();
  const limpa = (nos: NoTiptap[]): NoTiptap[] =>
    nos.flatMap((n) => {
      if (n.type === "subpagina") {
        const id = n.attrs?.pageId;
        if (typeof id !== "string" || !validas.has(id) || vistos.has(id)) return [];
        vistos.add(id);
        return [n];
      }
      return n.content ? [{ ...n, content: limpa(n.content) }] : [n];
    });
  const base = limpa(documento);
  const novos: NoTiptap[] = filhas.filter((id) => !vistos.has(id)).map((pageId) => ({ type: "subpagina", attrs: { pageId } }));
  return [...base, ...novos];
}

/** O documento sempre termina num parágrafo vazio: sem isso, depois de cartão ou tabela não dá para clicar e escrever. */
export function terminarComParagrafo(documento: Documento): Documento {
  const ultimo = documento[documento.length - 1];
  if (ultimo && ultimo.type === "paragraph" && !ultimo.content?.length) return documento;
  return [...documento, { type: "paragraph" }];
}
