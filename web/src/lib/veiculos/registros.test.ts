import { describe, expect, it } from "vitest";
import { planoDoRegistro } from "./registros";

const v = (status_ciclo: string, blindado = false, placa: string | null = null) => ({ status_ciclo, blindado, placa }) as never;
describe("registrar ações do veículo", () => {
  it("faturamento: data + avança o ciclo; se já está adiante, só a data", () => {
    expect(planoDoRegistro("faturamento", v("disponivel_sem_faturamento"), { data: "2026-11-12" })).toEqual({ patch: { data_faturamento: "2026-11-12", status_ciclo: "revisao_emplacamento" }, resumo: ["Faturado em 12/11/2026", "Ciclo de vida → Revisão e emplacamento"] });
    expect(planoDoRegistro("faturamento", v("disponivel"), { data: "2026-11-12" }).patch).toEqual({ data_faturamento: "2026-11-12" });
  });
  it("emplacamento: placa + data; blindado vai para Em blindagem, os demais para Pronto", () => {
    expect(planoDoRegistro("emplacamento", v("revisao_emplacamento"), { data: "2026-11-12", placa: "ABC1D23" }).patch).toEqual({ data_emplacamento: "2026-11-12", placa: "ABC1D23", status_ciclo: "disponivel" });
    expect(planoDoRegistro("emplacamento", v("revisao_emplacamento", true), { data: "2026-11-12", placa: "ABC1D23" }).patch.status_ciclo).toBe("em_blindagem");
  });
  it("devolução sempre leva a Devolvido; liberação só avança", () => {
    expect(planoDoRegistro("devolucao", v("em_devolucao"), { data: "2026-11-12" }).patch).toEqual({ data_devolucao: "2026-11-12", status_ciclo: "devolvido" });
    expect(planoDoRegistro("liberacao", v("pedido_recebido"), { data: "2026-11-12" }).patch.status_ciclo).toBe("liberado");
    expect(planoDoRegistro("liberacao", v("disponivel"), { data: "2026-11-12" }).patch).toEqual({ data_liberacao: "2026-11-12" });
  });
});
