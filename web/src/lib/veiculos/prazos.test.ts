import { describe, expect, it } from "vitest";
import { prazosDaPlaca, textoDeDias } from "./prazos";

describe("prazos da placa", () => {
  it("dias da chegada ao pedido das placas, do pedido ao emplacamento e o total", () => {
    expect(prazosDaPlaca({ data_chegada_planta: "2026-11-01", data_placas_solicitadas: "2026-11-04", data_emplacamento: "2026-11-15" })).toEqual({ paraSolicitar: 3, paraEmplacar: 11, total: 14 });
  });
  it("sem uma das datas, o prazo fica em branco", () => {
    expect(prazosDaPlaca({ data_chegada_planta: "2026-11-01", data_placas_solicitadas: null, data_emplacamento: null })).toEqual({ paraSolicitar: null, paraEmplacar: null, total: null });
    expect(textoDeDias(null)).toBe("—"); expect(textoDeDias(1)).toBe("1 dia"); expect(textoDeDias(5)).toBe("5 dias");
  });
});
