import { describe, expect, it } from "vitest";
import { chaveDoEndereco } from "./contatosDeEndereco";

describe("contato por endereço", () => {
  it("o mesmo endereço (maiúsculas e espaços à parte) é a mesma chave", () => {
    expect(chaveDoEndereco("  Av. Goiás,  1805 - Santa Paula ")).toBe(chaveDoEndereco("av. goiás, 1805 - santa paula"));
    expect(chaveDoEndereco(null)).toBe("");
  });
});
