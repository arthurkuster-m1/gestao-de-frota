import { describe, expect, it } from "vitest";
import { acharVeiculo, linhasDeMatriz, validarLista } from "./atualizacaoEmMassa";
import type { Veiculo } from "./tipos";

const v = (id: string, o: Partial<Veiculo>): Veiculo => ({ id, codigo: null, modelo: "Onix", cor: null, my: null, pedido: null, vin: null, placa: null, blindado: false, status_ciclo: "disponivel_sem_faturamento", data_faturamento: null, data_emplacamento: null, ...o }) as Veiculo;
const frota = [
  v("1", { codigo: "ONIX RS 1111", vin: "11111111111111111", pedido: "P1", status_ciclo: "disponivel_sem_faturamento" }),
  v("2", { codigo: "ONIX RS 2222", vin: "22222222222222222", pedido: "P1", status_ciclo: "revisao_emplacamento", data_faturamento: "2026-11-01" }),
  v("3", { codigo: "S10 3333", vin: "33333333333333333", placa: "ABC1D23", status_ciclo: "disponivel", data_emplacamento: "2026-11-02", data_faturamento: "2026-11-01" }),
  v("4", { codigo: "S10 4444", vin: "44444444444444444", status_ciclo: "devolvido" }),
];
const ctx = { veiculos: frota, data: "2026-11-12" };

describe("atualização em massa", () => {
  it("acha por VIN, código, placa e pedido (só nos campos da ação); pedido repetido é ambíguo", () => {
    expect("veiculo" in acharVeiculo(frota, " 11111111111111111 ", ["vin"])).toBe(true);
    expect("veiculo" in acharVeiculo(frota, "onix rs 2222", ["codigo"])).toBe(true);
    expect("veiculo" in acharVeiculo(frota, "abc-1d23", ["placa"])).toBe(true);
    expect(acharVeiculo(frota, "P1", ["pedido"])).toEqual({ erro: '"P1" bate com 2 veículos: use o VIN' });
    expect("erro" in acharVeiculo(frota, "ABC1D23", ["vin", "codigo"])).toBe(true);
  });
  it("faturamento: registra data e ciclo; já faturado é ignorado; devolvido dá erro", () => {
    const r = validarLista("faturamento", [{ ref: "11111111111111111" }, { ref: "22222222222222222" }, { ref: "44444444444444444" }, { ref: "999" }, {}], ctx);
    expect(r.map((x) => x.tom)).toEqual(["ok", "dup", "erro", "erro", "ign"]);
    expect(r[0]!.plano!.patch).toEqual({ data_faturamento: "2026-11-12", status_ciclo: "revisao_emplacamento" });
  });
  it("emplacamento: exige faturado, placa válida e única", () => {
    const r = validarLista("emplacamento", [{ ref: "22222222222222222", placa: "xyz9k88" }, { ref: "11111111111111111", placa: "XYZ9K88" }, { ref: "33333333333333333", placa: "AAA1B22" }, { ref: "22222222222222222", placa: "ZZZ" }], ctx);
    expect(r[0]).toMatchObject({ tom: "ok" }); expect(r[0]!.plano!.patch).toMatchObject({ placa: "XYZ9K88", data_emplacamento: "2026-11-12", status_ciclo: "disponivel" });
    expect(r[1]!.texto).toContain("ainda não foi faturado");
    expect(r[2]!.tom).toBe("dup");
    expect(r[3]!.texto).toContain("mais de uma vez");
  });
  it("devolução e reserva", () => {
    expect(validarLista("devolucao", [{ ref: "ABC1D23" }, { ref: "S10 4444" }], ctx).map((x) => x.tom)).toEqual(["ok", "dup"]);
    expect(validarLista("reserva", [{ ref: "ONIX RS 1111" }, { ref: "ONIX RS 2222" }], { ...ctx, jaNoEvento: new Set(["2"]) }).map((x) => x.tom)).toEqual(["ok", "dup"]);
  });
  it("matriz: ignora cabeçalho, lê referência e placa", () => {
    expect(linhasDeMatriz([["VIN", "Placa"], ["111", "ABC1D23"], ["222", ""]])).toEqual([{ ref: "111", placa: "ABC1D23" }, { ref: "222", placa: undefined }]);
    expect(linhasDeMatriz([["11111111111111111"]])).toEqual([{ ref: "11111111111111111", placa: undefined }]);
  });
});
