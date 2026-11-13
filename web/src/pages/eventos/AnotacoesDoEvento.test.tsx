// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const abrir = vi.fn();
vi.mock("../../lib/anotacoes/eventos", () => ({ abrirAnotacaoDoEvento: (id: string) => abrir(id), gravarAnotacaoDoEvento: vi.fn() }));
import { AnotacoesDoEvento } from "./AnotacoesDoEvento";

beforeAll(() => {
  const v = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  Range.prototype.getBoundingClientRect ??= v as never; Range.prototype.getClientRects ??= (() => []) as never; document.elementFromPoint ??= () => null;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(() => { cleanup(); abrir.mockReset(); });

describe("Anotações do evento", () => {
  it("abre o planejamento salvo daquele evento", async () => {
    abrir.mockResolvedValue([{ type: "paragraph", content: [{ type: "text", text: "Levar 2 caminhões" }] }]);
    render(<AnotacoesDoEvento eventoId="ev1" />);
    await waitFor(() => expect(screen.getByText("Levar 2 caminhões")).toBeTruthy());
    expect(abrir).toHaveBeenCalledWith("ev1");
  });

  it("mostra o erro quando o banco ainda não tem a tabela", async () => {
    abrir.mockRejectedValue(new Error("As anotações do evento ainda não foram ativadas no banco (falta rodar o SQL)."));
    render(<AnotacoesDoEvento eventoId="ev1" />);
    await waitFor(() => expect(screen.getByText(/falta rodar o SQL/)).toBeTruthy());
  });
});
