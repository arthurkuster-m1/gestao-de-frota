import { describe, expect, it } from "vitest";
import { converterColado, deTsv, intervaloDe, paraTsv } from "./selecao";
import type { CampoDaTela } from "./tipos";

describe("seleção de células", () => {
  it("intervalo é normalizado", () => expect(intervaloDe({ l: 3, c: 4 }, { l: 1, c: 2 })).toEqual({ l0: 1, l1: 3, c0: 2, c1: 4 }));
  it("TSV vai e volta, com TAB, aspas e quebra dentro da célula", () => {
    const m = [["a", "b\tc"], ['d"e', "f\ng"]];
    expect(deTsv(paraTsv(m))).toEqual(m);
  });
  it("lê o que o Excel copia", () => expect(deTsv("A\t1\r\nB\t2\r\n")).toEqual([["A", "1"], ["B", "2"]]));
  it("converte data br e opção pelo rótulo", () => {
    const data = { tipo: "data" } as CampoDaTela<unknown>;
    const op = { tipo: "opcao", opcoes: [{ value: "disp", label: "Disponível" }] } as unknown as CampoDaTela<unknown>;
    expect(converterColado(data, "05/11/2026")).toBe("2026-11-05");
    expect(converterColado(data, "lixo")).toBeUndefined();
    expect(converterColado(op, "disponível")).toBe("disp");
    expect(converterColado(op, "outra")).toBeUndefined();
  });
});
