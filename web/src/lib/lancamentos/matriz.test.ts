import { describe, expect, it } from "vitest";
import { erroDeOpcao, linhaEstaVazia, linhasDeMatriz, textoParaOpcao } from "./matriz";
import type { Coluna } from "./tipos";

const cols: Coluna[] = [{ id: "ref", titulo: "Referência (VIN ou Código)", largura: 200 }, { id: "status", titulo: "Status", largura: 120, opcoes: [{ value: "em_reparo", label: "Em reparo" }, { value: "pronto", label: "Pronto" }] }, { id: "data", titulo: "Data", largura: 100 }];
describe("lançamentos: leitura da planilha colada", () => {
  it("texto → opção (rótulo, valor, sem acento/caixa) e desconhecido fica como veio", () => {
    expect(textoParaOpcao("em reparo", cols[1]!.opcoes!)).toBe("em_reparo"); expect(textoParaOpcao("PRONTO", cols[1]!.opcoes!)).toBe("pronto"); expect(textoParaOpcao("xis", cols[1]!.opcoes!)).toBe("xis");
  });
  it("com cabeçalho: acha as colunas pelo título (mesmo fora de ordem); converte a opção", () => {
    expect(linhasDeMatriz([["Status", "Referência", "Data"], ["Em reparo", "ONIX 1", "05/11/2026"]], cols)).toEqual([{ status: "em_reparo", ref: "ONIX 1", data: "05/11/2026" }]);
  });
  it("sem cabeçalho: vale a ordem das colunas", () => expect(linhasDeMatriz([["ONIX 1", "pronto"]], cols)).toEqual([{ ref: "ONIX 1", status: "pronto" }]));
  it("opção inválida vira erro com as alternativas; linha vazia é vazia", () => {
    expect(erroDeOpcao({ ref: "x", status: "xis" }, cols)).toContain('"xis" não é uma opção'); expect(erroDeOpcao({ ref: "x", status: "pronto" }, cols)).toBeNull();
    expect(linhaEstaVazia({ ref: " " })).toBe(true);
  });
});
