import { describe, expect, it } from "vitest";
import { diasDeViagem, paraNumero, reservasDoTransporte, valorPorEvento } from "./regras";
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
