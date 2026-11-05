import { describe, expect, it } from "vitest";
import { avisoDoCicloAutomatico } from "./ciclo";
import type { Veiculo } from "./tipos";

const base = { id: "1", codigo: null, modelo: "Onix", versao: null, cor: null, my: null, pedido: null, vin: null, placa: null, blindado: false, seguro_status: "pendente", status_ciclo: "pedido_recebido", data_pedido: null, data_liberacao: null, data_faturamento: null, data_emplacamento: null, data_devolucao: null, comentarios: null, created_at: "2026-01-01T00:00:00Z" } as Veiculo;
describe("avisoDoCicloAutomatico", () => {
  it("avisa o status que mudou sozinho ao preencher uma data", () => {
    expect(avisoDoCicloAutomatico(base, { ...base, data_liberacao: "2026-10-01", status_ciclo: "liberado" }, "data_liberacao")).toBe("Atualizei também: ciclo de vida → Liberado");
  });
  it("avisa a data que entrou sozinha ao mudar o status", () => {
    expect(avisoDoCicloAutomatico(base, { ...base, status_ciclo: "devolvido", data_devolucao: "2026-11-05" }, "status_ciclo")).toBe("Atualizei também: devolvido em 05/11/2026");
  });
  it("não avisa quando só mudou o que a pessoa editou", () => {
    expect(avisoDoCicloAutomatico(base, { ...base, cor: "Preto" }, "cor")).toBeNull();
    expect(avisoDoCicloAutomatico(base, { ...base, data_faturamento: "2026-10-01" }, "data_faturamento")).toBeNull();
  });
});
