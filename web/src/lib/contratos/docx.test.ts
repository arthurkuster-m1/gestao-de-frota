import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { gerarDocx, marcadoresDoModelo, trocarNoParagrafo } from "./docx";

const modelo = (n: string) => readFileSync(new URL(`../../../public/modelos/${n}.docx`, import.meta.url));
const texto = async (b: Blob) => { const z = await JSZip.loadAsync(await b.arrayBuffer()); const x = await z.file("word/document.xml")!.async("string"); return (x.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("|"); };

describe("docx", () => {
  it("troca marcadores quebrados em vários trechos e escapa o texto", () => {
    const p = '<w:p><w:r><w:t>Olá {{cli</w:t></w:r><w:r><w:t>ente_nome}}, ok</w:t></w:r></w:p>';
    expect(trocarNoParagrafo(p, { cliente_nome: "A & B <Ltda>" })).toContain("Olá A &amp; B &lt;Ltda&gt;");
    expect(trocarNoParagrafo(p, { cliente_nome: "X" }).replace(/<[^>]+>/g, "")).toBe("Olá X, ok");
  });
  it("marcador desconhecido fica como está", () => {
    expect(trocarNoParagrafo("<w:p><w:r><w:t>{{x}} {{y}}</w:t></w:r></w:p>", { x: "1" }).replace(/<[^>]+>/g, "")).toBe("1 {{y}}");
  });
  it("os 3 modelos trazem os marcadores esperados", async () => {
    expect(await marcadoresDoModelo(modelo("contrato-comodato"))).toEqual(expect.arrayContaining(["cliente_nome", "veiculo_modelo", "data_inicio", "local_endereco", "motorista_nome"]));
    expect(await marcadoresDoModelo(modelo("aditivo-substituicao"))).toEqual(expect.arrayContaining(["sai_placa", "entra_vin", "data_efeito", "ordinal"]));
    expect(await marcadoresDoModelo(modelo("aditivo-prorrogacao"))).toEqual(expect.arrayContaining(["nova_data_fim", "parte"]));
  });
  it("gera o contrato com uma linha por veículo e sem marcadores sobrando", async () => {
    const b = await gerarDocx(modelo("contrato-comodato"), { cliente_nome: "ACME LTDA", cliente_endereco: "Rua A, nº 1", cliente_documento: "12.345.678/0001-90", cliente_documento_tipo: "CNPJ/MF", data_inicio: "01/12/2026", data_fim: "10/12/2026", objetivo: "o evento X", local_endereco: "Av. B, 2" },
      { veiculo: [{ modelo: "ONIX", vin: "V1", cor: "Branco", placa: "AAA1A11" }, { modelo: "S10", vin: "V2", cor: "Preto", placa: "BBB2B22" }], motorista: [] });
    const t = await texto(b);
    expect(t).toContain("ACME LTDA"); expect(t).toContain("ONIX"); expect(t).toContain("S10"); expect(t).toContain("BBB2B22"); expect(t).toContain("01/12/2026");
    expect(t).not.toMatch(/\{\{/);
  });
  it("gera a substituição de veículo", async () => {
    const t = await texto(await gerarDocx(modelo("aditivo-substituicao"), { ordinal: "Primeiro", ordinal_caps: "PRIMEIRO", tipo_contrato: "Comodato", tipo_contrato_caps: "COMODATO", parte: "COMODATÁRIO", cliente_nome: "ACME", cliente_documento: "1", cliente_documento_tipo: "CNPJ", cliente_endereco: "R", data_assinatura: "01/01/2026", data_efeito: "07/07/2026" }, { sai: [{ modelo: "A", vin: "1", cor: "x", placa: "P1" }], entra: [{ modelo: "B", vin: "2", cor: "y", placa: "P2" }] }));
    expect(t).toContain("PRIMEIRO"); expect(t).toContain("COMODATÁRIO"); expect(t).toContain("P2"); expect(t).not.toMatch(/\{\{/);
  });
});
