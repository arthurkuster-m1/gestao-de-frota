import { describe, expect, it } from "vitest";
import { planoDoRegistro, proximosPassos } from "./registros";

const v = (status_ciclo: string, blindado = false, placa: string | null = null) => ({ status_ciclo, blindado, placa }) as never;
describe("registrar ações do veículo", () => {
  it("faturamento registra a data e leva Disponível sem faturamento a Disponível sem placa", () => {
    expect(planoDoRegistro("faturamento", v("disponivel_sem_faturamento"), { data: "2026-11-12" })).toEqual({ patch: { data_faturamento: "2026-11-12", faturado: true, status_ciclo: "disponivel_sem_placa" }, resumo: ["Faturado em 12/11/2026", "Ciclo de vida → Disponível sem placa"] });
    expect(planoDoRegistro("faturamento", v("disponivel"), { data: "2026-11-12" }).patch).toEqual({ data_faturamento: "2026-11-12", faturado: true });
  });
  it("emplacamento: placa + data; blindado vai para Em blindagem, os demais para Pronto", () => {
    expect(planoDoRegistro("emplacamento", v("disponivel_sem_faturamento"), { data: "2026-11-12", placa: "ABC1D23" }).patch).toEqual({ data_emplacamento: "2026-11-12", placa: "ABC1D23", status_ciclo: "disponivel" });
    expect(planoDoRegistro("emplacamento", v("disponivel_sem_faturamento", true), { data: "2026-11-12", placa: "ABC1D23" }).patch.status_ciclo).toBe("em_blindagem");
  });
  it("devolução sempre leva a Devolvido; liberação só avança", () => {
    expect(planoDoRegistro("devolucao", v("em_devolucao"), { data: "2026-11-12" }).patch).toEqual({ data_devolucao: "2026-11-12", status_ciclo: "devolvido" });
    expect(planoDoRegistro("liberacao", v("pedido_recebido"), { data: "2026-11-12" }).patch.status_ciclo).toBe("liberado");
    expect(planoDoRegistro("liberacao", v("disponivel"), { data: "2026-11-12" }).patch).toEqual({ data_liberacao: "2026-11-12" });
  });
  it("só os próximos passos lógicos, do pedido à devolução", () => {
    const p = (c: string) => proximosPassos({ status_ciclo: c } as never);
    expect(p("pedido_recebido")).toEqual(["liberacao"]);
    expect(p("liberado")).toEqual(["chegada"]);
    expect(p("disponivel_sem_faturamento")).toEqual(["faturamento", "devolucao"]);   // faturar OU devolver
    const q = (o: object) => proximosPassos({ status_ciclo: "disponivel_sem_faturamento", ...o } as never);
    expect(q({ data_faturamento: "2026-11-01" })).toEqual(["placas", "emplacamento", "devolucao"]);   // faturado: pedir as placas ou já emplacar
    expect(q({ data_faturamento: "2026-11-01", data_placas_solicitadas: "2026-11-05" })).toEqual(["emplacamento", "devolucao"]);
    expect(p("disponivel")).toEqual(["devolucao"]); expect(p("em_blindagem")).toEqual(["devolucao"]);
    expect(p("devolvido")).toEqual([]);
  });
  it("chegada na planta registra a data e leva o ciclo a Disponível sem faturamento; placas solicitadas só registra a data", () => {
    expect(planoDoRegistro("chegada", v("liberado"), { data: "2026-11-12" })).toEqual({ patch: { data_chegada_planta: "2026-11-12", status_ciclo: "disponivel_sem_faturamento" }, resumo: ["Chegou na planta em 12/11/2026", "Ciclo de vida → Disponível sem faturamento"] });
  });
});

describe("faturado sem data (histórico antigo)", () => {
  it("o próximo passo e as placas aceitam o carro marcado como faturado", () => {
    expect(proximosPassos({ status_ciclo: "disponivel_sem_faturamento", faturado: true } as never)).toEqual(["placas", "emplacamento", "devolucao"]);
    expect(proximosPassos({ status_ciclo: "disponivel_sem_faturamento" } as never)).toEqual(["faturamento", "devolucao"]);
  });
});
