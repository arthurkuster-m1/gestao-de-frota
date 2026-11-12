// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PrevisoesQueChegaram } from "./PrevisoesQueChegaram";

afterEach(cleanup);
const carro = { status_ciclo: "pedido_recebido", data_liberacao_prevista: "2026-11-10" } as never;

describe("aviso de previsão que chegou", () => {
  it("pergunta se foi realizado e confirma", () => {
    const aoConfirmar = vi.fn().mockResolvedValue(undefined);
    render(<PrevisoesQueChegaram veiculo={carro} hoje="2026-11-12" aoConfirmar={aoConfirmar} aoAdiar={vi.fn()} />);
    expect(screen.getByText(/o carro foi liberado\?/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("previsao-foi-realizado"));
    expect(aoConfirmar).toHaveBeenCalledWith(expect.objectContaining({ id: "liberacao" }));
  });
  it("adiar: escolher nova data muda a previsão", () => {
    const aoAdiar = vi.fn().mockResolvedValue(undefined);
    render(<PrevisoesQueChegaram veiculo={carro} hoje="2026-11-12" aoConfirmar={vi.fn()} aoAdiar={aoAdiar} />);
    const campo = screen.getByLabelText("Nova data prevista de liberação");
    fireEvent.change(campo, { target: { value: "20/11/2026" } });
    expect(aoAdiar).toHaveBeenCalledWith(expect.objectContaining({ id: "liberacao" }), "2026-11-20");
  });
  it("antes da data não mostra nada", () => {
    render(<PrevisoesQueChegaram veiculo={carro} hoje="2026-11-09" aoConfirmar={vi.fn()} aoAdiar={vi.fn()} />);
    expect(screen.queryByTestId("previsoes-que-chegaram")).toBeNull();
  });
});
