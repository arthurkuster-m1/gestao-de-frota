import { describe, expect, it } from "vitest";
import { lerEnderecoColado, buscarCep, cidadeEUf, ENDERECO_VAZIO, enderecoValido, formatarEndereco, lerEndereco, mascaraCep } from "./enderecos";

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

describe("endereço colado", () => {
  it("formato do Google Maps", () => {
    expect(lerEnderecoColado("Av. Goiás, 1805 - Santa Paula, São Caetano do Sul - SP, 09521-300")).toEqual({ cep: "09521-300", cidade: "São Caetano do Sul", uf: "SP", rua: "Av. Goiás", numero: "1805", complemento: "Santa Paula" });
  });
  it("com bairro em segmento próprio e 'CEP' escrito", () => {
    expect(lerEnderecoColado("Rua das Flores, 120, Centro, Morro Redondo - RS, CEP 96150-000")).toEqual({ cep: "96150-000", cidade: "Morro Redondo", uf: "RS", rua: "Rua das Flores", numero: "120", complemento: "Centro" });
  });
  it("cidade/UF e sem número; só CEP e cidade", () => {
    expect(lerEnderecoColado("Estrada Velha, s/n, Pelotas/RS 96000-000")).toMatchObject({ rua: "Estrada Velha", numero: "S/N", cidade: "Pelotas", uf: "RS", cep: "96000-000" });
    expect(lerEnderecoColado("96150-000")).toEqual({ cep: "96150-000" });
    expect(lerEnderecoColado("   ")).toBeNull();
  });
  it("a máscara do app continua valendo", () => {
    expect(lerEnderecoColado("Rua A, 1 - Cuiabá/MT - CEP 78000-000")).toMatchObject({ rua: "Rua A", cidade: "Cuiabá", uf: "MT" });
  });
  it("CEP sem rua (cidade pequena) vem da BrasilAPI quando a ViaCEP não acha", async () => {
    const f = (async (u: string) => (String(u).includes("viacep") ? { ok: true, json: async () => ({ erro: true }) } : { ok: true, json: async () => ({ city: "Morro Redondo", state: "RS", street: null }) })) as unknown as typeof fetch;
    expect(await buscarCep("96150-000", f)).toEqual({ rua: "", bairro: "", cidade: "Morro Redondo", uf: "RS" });
  });
});
