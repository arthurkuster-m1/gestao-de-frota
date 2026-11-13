// @vitest-environment jsdom
/**
 * O editor de Anotações abre com o conteúdo salvo, mostra a subpágina como cartão (com o título vivo da árvore),
 * acrescenta o cartão da filha que ainda não tinha e abre só para leitura se não entender o conteúdo.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import EditorDeNotas from "./EditorDeNotas";
import type { ResumoDaNota } from "../../lib/anotacoes/paginas";

function nota(id: string, parent: string | null, title: string, position = 1): ResumoDaNota {
  return { id, parent_id: parent, title, icon: null, position, kind: null, deleted_at: null, updated_at: "2026-11-12T00:00:00Z" };
}

// O jsdom não tem o que o ProseMirror pede do navegador: estas são as pontes mínimas.
beforeAll(() => {
  const vazio = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  Range.prototype.getBoundingClientRect ??= vazio as never;
  Range.prototype.getClientRects ??= (() => [] as unknown as DOMRectList) as never;
  document.elementFromPoint ??= () => null;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

const comuns = { aoMudar: () => undefined, aoAbrir: () => undefined, aoCriarSubpagina: async () => null, aoRemoverSubpagina: () => undefined, aoReordenarSubpaginas: () => undefined };

describe("EditorDeNotas", () => {
  it("abre o texto salvo e os cartões das subpáginas, inclusive a que ainda não tinha cartão", async () => {
    render(
      <EditorDeNotas {...comuns} editavel paginaId="mae"
        inicial={[{ type: "paragraph", content: [{ type: "text", text: "Reunião de segunda" }] }, { type: "subpagina", attrs: { pageId: "filha1" } }]}
        paginas={[nota("mae", null, "Mãe"), nota("filha1", "mae", "Contrato assinado", 1), nota("filha2", "mae", "Briefing", 2)]} />,
    );
    await waitFor(() => expect(screen.getByText("Reunião de segunda")).toBeTruthy());
    await waitFor(() => expect(screen.getByText("Contrato assinado")).toBeTruthy());
    expect(screen.getByText("Briefing")).toBeTruthy();
  });

  it("não mostra cartão de página que não é mais filha desta", async () => {
    render(<EditorDeNotas {...comuns} editavel={false} paginaId="mae" inicial={[{ type: "subpagina", attrs: { pageId: "outra" } }]} paginas={[nota("mae", null, "Mãe"), nota("outra", null, "Solta")]} />);
    await waitFor(() => expect(document.querySelector(".ProseMirror")).toBeTruthy());
    expect(screen.queryByText("Solta")).toBeNull();
  });

  it("abre só para leitura quando o conteúdo não é entendido (nunca grava por cima)", async () => {
    render(<EditorDeNotas {...comuns} editavel paginaId="mae" inicial={[{ type: "listItem", content: [{ type: "heading", content: [{ type: "text", text: "solto" }] }] } as never]} paginas={[nota("mae", null, "Mãe")]} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(document.querySelector(".ProseMirror")?.getAttribute("contenteditable")).toBe("false");
  });
});
