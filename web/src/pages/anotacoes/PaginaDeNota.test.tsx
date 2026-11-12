// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PaginaDeNota } from "./PaginaDeNota";
import type { ResumoDaNota } from "../../lib/anotacoes/paginas";

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as never;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  const v = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  Range.prototype.getBoundingClientRect ??= v as never; Range.prototype.getClientRects ??= (() => []) as never; document.elementFromPoint ??= () => null;
});
afterEach(cleanup);

const nota: ResumoDaNota = { id: "n1", parent_id: null, title: "Reunião", icon: null, position: 1, kind: null, deleted_at: null, updated_at: "2026-11-12T00:00:00Z" };
const estado = { nota: { blocks: [] }, salvando: false, erro: null, mudar: vi.fn() } as never;

describe("Página de anotação", () => {
  it("Enter no título leva o cursor para a primeira linha do texto", async () => {
    render(<PaginaDeNota nota={nota} todas={[nota]} estado={estado} onSelecionar={() => undefined} onTitulo={() => undefined} onIcone={() => undefined} onCriarSubpagina={async () => null} onRemoverSubpagina={() => undefined} onReordenarSubpaginas={() => undefined} />);
    await waitFor(() => expect(document.querySelector(".bn-editor[contenteditable='true']")).toBeTruthy());
    const titulo = screen.getByTestId("titulo-da-pagina"); titulo.focus();
    fireEvent.keyDown(titulo, { key: "Enter" });
    await waitFor(() => expect(document.activeElement?.closest(".bn-editor")).toBeTruthy());
    expect(document.activeElement).not.toBe(titulo);
  });
});
