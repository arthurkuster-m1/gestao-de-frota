import { describe, expect, it } from "vitest";
import { diasDeViagem, paraNumero, reservasDoTransporte, rodapeDeTransportes, somarValores, valorPorEvento, valoresPorEventoESentido } from "./regras";
import { STATUS_DA_MODALIDADE, type Transporte } from "./tipos";

describe("dias de viagem", () => {
  it("km ÷ 500 para cima; retirada e sem km = 0", () => {
    expect(diasDeViagem(3000, "pta")).toBe(6);
    expect(diasDeViagem(600, "tso")).toBe(2);
    expect(diasDeViagem(500, "pta")).toBe(1);
    expect(diasDeViagem(501, "pta")).toBe(2);
    expect(diasDeViagem(2000, "retirada")).toBe(0);
    expect(diasDeViagem(null, "pta")).toBe(0);
  });
});
describe("número digitado", () => {
  it("aceita vírgula, ponto de milhar e R$", () => {
    expect(paraNumero("1234,56")).toBe(1234.56);
    expect(paraNumero("1.234,56")).toBe(1234.56);
    expect(paraNumero("1234.56")).toBe(1234.56);
    expect(paraNumero("R$ 1.500,00")).toBe(1500);
    expect(paraNumero("abc")).toBeNull();
    expect(paraNumero("  ")).toBeNull();
  });
});
describe("status de pagamento (dentro do transporte)", () => {
  it("PTA: Solicitado, Aprovado, Pago; TSO: Orçamento recebido, Aprovar NF, Aprovado; retirada: nenhum", () => {
    expect(STATUS_DA_MODALIDADE.pta.map((s) => s.label)).toEqual(["Solicitado", "Aprovado", "Pago"]);
    expect(STATUS_DA_MODALIDADE.tso.map((s) => s.label)).toEqual(["Orçamento recebido", "Aprovar NF", "Aprovado"]);
    expect(STATUS_DA_MODALIDADE.retirada).toEqual([]);
  });
});
describe("ligações", () => {
  it("valor do evento = soma dos transportes; carros do transporte pelo sentido", () => {
    const t = (id: string, ev: string, v: number | null) => ({ id, evento_id: ev, valor_planejado: v, sentido: "ida" }) as Transporte;
    expect(valorPorEvento([t("1", "e1", 100.5), t("2", "e1", 50), t("3", "e2", null)]).get("e1")).toBe(150.5);
    expect(valorPorEvento([t("3", "e2", null)]).has("e2")).toBe(false);
    expect(reservasDoTransporte({ id: "t1", sentido: "ida" }, [{ id: "r1", transporte_ida_id: "t1", transporte_volta_id: null }, { id: "r2", transporte_ida_id: null, transporte_volta_id: "t1" }])).toEqual(["r1"]);
  });
});

import { TODOS_STATUS_PAGAMENTO } from "./tipos";
describe("ordem oficial dos status de pagamento", () => {
  it("Solicitado, Orçamento recebido, Aprovar NF, Aprovado e Pago", () => {
    expect(TODOS_STATUS_PAGAMENTO.map((s) => s.value)).toEqual(["solicitado", "orcamento_recebido", "aprovar_nf", "aprovado", "pago"]);
  });
});

describe("menos de 200 km: mesmo dia", () => {
  it("sem dia de viagem abaixo de 200 km; de 200 km em diante, km ÷ 500 para cima", () => {
    expect(diasDeViagem(150, "pta")).toBe(0);
    expect(diasDeViagem(199, "pta")).toBe(0);
    expect(diasDeViagem(200, "pta")).toBe(1);
    expect(diasDeViagem(501, "pta")).toBe(2);
  });
});

describe("valores do transporte separados por sentido e somados no rodapé", () => {
  const t = (id: string, ev: string, sentido: "ida" | "volta", plan: number | null, real: number | null, pago: string | null) =>
    ({ id, evento_id: ev, sentido, valor_planejado: plan, valor_real: real, data_pagamento: pago }) as Transporte;
  it("ida e volta ficam em colunas separadas, cada uma com a sua data de pagamento", () => {
    const m = valoresPorEventoESentido([t("1", "e1", "ida", 1000, 900, "2026-10-28"), t("2", "e1", "volta", 1100, null, null), t("3", "e1", "ida", 50.5, 50.5, "2026-11-03")]);
    expect(m.get("e1")!.ida).toEqual({ planejado: 1050.5, real: 950.5, pagoEm: "2026-11-03" });
    expect(m.get("e1")!.volta).toEqual({ planejado: 1100, real: null, pagoEm: null });
  });
  it("evento sem transporte de um lado fica com esse lado vazio (null, não zero)", () => {
    const m = valoresPorEventoESentido([t("1", "e2", "ida", null, null, null)]);
    expect(m.get("e2")!.volta).toEqual({ planejado: null, real: null, pagoEm: null });
    expect(m.get("e2")!.ida.planejado).toBeNull();
  });
  it("soma planejado e real (vazio não conta) e monta o texto do rodapé", () => {
    const ls = [t("1", "e1", "ida", 1000, 900, null), t("2", "e1", "volta", 250.1, null, null), t("3", "e2", "ida", null, 0.2, null)];
    expect(somarValores(ls)).toEqual({ planejado: 1250.1, real: 900.2 });
    expect(somarValores([])).toEqual({ planejado: 0, real: 0 });
    expect(rodapeDeTransportes(3, ls).replace(/\u00a0/g, " ")).toBe("3 transportes · planejado R$ 1.250,10 · real R$ 900,20");
    expect(rodapeDeTransportes(1, [ls[0]!], " deste evento").replace(/\u00a0/g, " ")).toBe("1 transporte deste evento · planejado R$ 1.000,00 · real R$ 900,00");
  });
});
