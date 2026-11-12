import { describe, expect, it } from "vitest";
import { nomeDoArquivoDoContrato, tituloDoContrato } from "./documentos";

describe("título do contrato", () => {
  it("COMODATO | EVENTO [início ATÉ retirada]", () => {
    expect(tituloDoContrato("Expointer TD - Andreia Oliveira", "2026-11-16", "2026-11-30")).toBe("COMODATO | EXPOINTER TD - ANDREIA OLIVEIRA [16/11/26 ATÉ 30/11/26]");
  });
  it("nome de arquivo sem / e |", () => {
    expect(nomeDoArquivoDoContrato("Expointer TD - Andreia Oliveira", "2026-11-16", "2026-11-30")).toBe("COMODATO - EXPOINTER TD - ANDREIA OLIVEIRA [16-11-26 ATÉ 30-11-26].docx");
  });
  it("sem datas, só o nome", () => expect(tituloDoContrato("Feira X", null, null)).toBe("COMODATO | FEIRA X"));
});
