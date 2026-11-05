import { describe, expect, it } from "vitest";
import { cnpjValido, cpfValido, maskCep, maskCnpj, maskCpf } from "./documentos";

describe("documentos", () => {
  it("CPF: aceita válido, recusa dígito errado, repetido e tamanho errado", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224726")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("123")).toBe(false);
  });
  it("CNPJ: aceita válido, recusa dígito errado e repetido", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000182")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
  });
  it("máscaras crescem enquanto digita", () => {
    expect(maskCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("5299")).toBe("529.9");
    expect(maskCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(maskCnpj("112223")).toBe("11.222.3");
    expect(maskCep("01310100")).toBe("01310-100");
  });
});
