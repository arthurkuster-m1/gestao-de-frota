import { describe, expect, it } from "vitest";
import { diasDeViagem, paraNumero, pagamentosQueCombinam, reservasDoTransporte, valorPorEvento } from "./regras";
import { STATUS_DO_TIPO, type Pagamento, type Transporte } from "./tipos";

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
describe("status de pagamento", () => {
  it("PTA: Solicitado, Aprovado, Pago; NF da TSO: Orçamento recebido, Aprovar NF, Aprovado", () => {
    expect(STATUS_DO_TIPO.pta.map((s) => s.label)).toEqual(["Solicitado", "Aprovado", "Pago"]);
    expect(STATUS_DO_TIPO.nf_tso.map((s) => s.label)).toEqual(["Orçamento recebido", "Aprovar NF", "Aprovado"]);
  });
});
describe("ligações", () => {
  const p = (tipo: "pta" | "nf_tso", id: string) => ({ id, tipo }) as Pagamento;
  it("PTA liga com PTA, TSO com NF, retirada com nada", () => {
    const l = [p("pta", "a"), p("nf_tso", "b")];
    expect(pagamentosQueCombinam("pta", l).map((x) => x.id)).toEqual(["a"]);
    expect(pagamentosQueCombinam("tso", l).map((x) => x.id)).toEqual(["b"]);
    expect(pagamentosQueCombinam("retirada", l)).toEqual([]);
  });
  it("valor do evento = soma dos transportes; carros do transporte pelo sentido", () => {
    const t = (id: string, ev: string, v: number | null) => ({ id, evento_id: ev, valor_planejado: v, sentido: "ida" }) as Transporte;
    expect(valorPorEvento([t("1", "e1", 100.5), t("2", "e1", 50), t("3", "e2", null)]).get("e1")).toBe(150.5);
    expect(valorPorEvento([t("3", "e2", null)]).has("e2")).toBe(false);
    expect(reservasDoTransporte({ id: "t1", sentido: "ida" }, [{ id: "r1", transporte_ida_id: "t1", transporte_volta_id: null }, { id: "r2", transporte_ida_id: null, transporte_volta_id: "t1" }])).toEqual(["r1"]);
  });
});
