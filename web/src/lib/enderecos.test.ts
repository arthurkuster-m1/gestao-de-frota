import { describe, expect, it } from "vitest";
import { buscarCep, cidadeEUf, ENDERECO_VAZIO, enderecoValido, formatarEndereco, lerEndereco, mascaraCep } from "./enderecos";

const base = { ...ENDERECO_VAZIO, rua: "Rua Araci", numero: "583", cidade: "Santo André", uf: "sp", cep: "09090123" };
describe("endereço numa linha", () => {
  it("formata na máscara, com e sem complemento", () => {
    expect(formatarEndereco(base)).toBe("Rua Araci, 583 - Santo André/SP - CEP 09090-123");
    expect(formatarEndereco({ ...base, complemento: "Sala 2" })).toBe("Rua Araci, 583, Sala 2 - Santo André/SP - CEP 09090-123");
  });
  it("devolve vazio enquanto faltar parte", () => { expect(formatarEndereco({ ...base, cep: "0909" })).toBe(""); expect(formatarEndereco({ ...base, numero: "" })).toBe(""); });
  it("lê de volta e valida", () => {
    expect(lerEndereco("Rua Araci, 583, Sala 2 - Santo André/SP - CEP 09090-123")).toEqual({ rua: "Rua Araci", numero: "583", complemento: "Sala 2", cidade: "Santo André", uf: "SP", cep: "09090-123" });
    expect(lerEndereco("Rua Araci, 583 - Santo André/SP - CEP 09090-123")?.complemento).toBe("");
    expect(enderecoValido("Rua Araci, 583")).toBe(false);
    expect(cidadeEUf("Av. Paulista, 1000 - São Paulo/SP - CEP 01310-100")).toEqual({ cidade: "São Paulo", estado: "SP" });
  });
  it("máscara do CEP", () => { expect(mascaraCep("09090123")).toBe("09090-123"); expect(mascaraCep("09090")).toBe("09090"); expect(mascaraCep("a0909-0123x9")).toBe("09090-123"); });
  it("busca de CEP: acha, não acha e sem rede", async () => {
    const ok = (async () => ({ ok: true, json: async () => ({ logradouro: "Rua Araci", bairro: "Jd", localidade: "Santo André", uf: "SP" }) })) as unknown as typeof fetch;
    expect(await buscarCep("09090-123", ok)).toEqual({ rua: "Rua Araci", bairro: "Jd", cidade: "Santo André", uf: "SP" });
    expect(await buscarCep("09090-123", (async () => ({ ok: true, json: async () => ({ erro: true }) })) as unknown as typeof fetch)).toBeNull();
    expect(await buscarCep("09090-123", (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toBeNull();
    expect(await buscarCep("123")).toBeNull();
  });
});
