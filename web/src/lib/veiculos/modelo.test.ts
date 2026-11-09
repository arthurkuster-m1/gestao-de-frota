import { describe, expect, it } from "vitest";
import { partirModelo } from "./modelo";

describe("partirModelo", () => {
  it("1ª palavra é a mãe, o resto é a versão", () => expect(partirModelo("S10 High Country")).toEqual({ mae: "S10", versao: "High Country" }));
  it("sem versão", () => expect(partirModelo("Onix")).toEqual({ mae: "Onix", versao: null }));
  it("espaços sobrando e vazio", () => { expect(partirModelo("  Onix   RS ")).toEqual({ mae: "Onix", versao: "RS" }); expect(partirModelo(null)).toEqual({ mae: null, versao: null }); });
});
