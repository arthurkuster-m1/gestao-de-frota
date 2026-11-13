import { describe, expect, it } from "vitest";
import { camposDoContrato, linkValido, type ContextoDeContratos } from "./camposDeContratos";
import type { Contrato } from "../../lib/contratos/tipos";

const campo = camposDoContrato({} as ContextoDeContratos).find((c) => c.id === "link")!;
describe("link do contrato", () => {
  it("aceita só http(s) completo", () => {
    expect(linkValido("https://secure.d4sign.com.br/doc/abc")).toBe(true);
    expect(linkValido("d4sign.com.br/doc")).toBe(false);
    expect(linkValido("javascript:alert(1)")).toBe(false);
  });
  it("colar sem https:// completa sozinho", () => {
    expect(campo.edicao!.normalizar!("secure.d4sign.com.br/doc/abc")).toBe("https://secure.d4sign.com.br/doc/abc");
    expect(campo.edicao!.normalizar!("  https://x.com/a ")).toBe("https://x.com/a");
  });
  it("o valor da coluna é o link do contrato", () => {
    expect(campo.valorDe({ link: "https://x.com/a" } as Contrato)).toBe("https://x.com/a");
    expect(campo.valorDe({} as Contrato)).toBeNull();
  });
});
