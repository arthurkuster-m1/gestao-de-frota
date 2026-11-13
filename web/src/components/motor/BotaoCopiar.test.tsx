// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "../../ds";
import { BotaoCopiar } from "./BotaoCopiar";

afterEach(cleanup);
describe("BotaoCopiar", () => {
  it("copia o texto inteiro do endereço", async () => {
    const escrever = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: escrever }, configurable: true });
    render(<ToastProvider><BotaoCopiar texto="Av. Paulista, 1000 - São Paulo/SP - CEP 01310-100" /></ToastProvider>);
    fireEvent.click(screen.getByLabelText("Copiar endereço"));
    await waitFor(() => expect(escrever).toHaveBeenCalledWith("Av. Paulista, 1000 - São Paulo/SP - CEP 01310-100"));
  });
  it("sem endereço não mostra o botão", () => {
    render(<ToastProvider><BotaoCopiar texto={null} /></ToastProvider>);
    expect(screen.queryByLabelText("Copiar endereço")).toBeNull();
  });
});
