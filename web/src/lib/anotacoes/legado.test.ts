import { describe, expect, it } from "vitest";
import { converterBlocos, ehFormatoAntigo } from "./legado";
import { lerDocumento } from "./documento";
import { textoDoDocumento } from "./busca";

const t = (text: string, styles: Record<string, boolean> = {}) => ({ type: "text", text, styles });
const bloco = (type: string, extra: Record<string, unknown> = {}) => ({ id: `b${Math.random()}`, type, props: {}, children: [], ...extra });

describe("anotações — conversor do formato antigo", () => {
  it("reconhece o formato antigo", () => {
    expect(ehFormatoAntigo([bloco("paragraph")])).toBe(true);
    expect(ehFormatoAntigo([{ type: "paragraph" }])).toBe(false);
    expect(ehFormatoAntigo([])).toBe(false);
  });

  it("agrupa itens de lista seguidos numa lista só, com os aninhados dentro do item", () => {
    const r = converterBlocos([
      bloco("bulletListItem", { content: [t("A")], children: [bloco("bulletListItem", { content: [t("A1")] })] }),
      bloco("bulletListItem", { content: [t("B")] }),
      bloco("paragraph", { content: [t("meio")] }),
      bloco("numberedListItem", { content: [t("1")] }),
      bloco("checkListItem", { content: [t("feito")], props: { checked: true } }),
    ]);
    expect(r.map((n) => n.type)).toEqual(["bulletList", "paragraph", "orderedList", "taskList"]);
    expect(r[0]!.content).toHaveLength(2);
    expect(r[0]!.content![0]!.content!.map((n) => n.type)).toEqual(["paragraph", "bulletList"]);
    expect(r[3]!.content![0]!.attrs).toEqual({ checked: true });
  });

  it("toggle vira details com os filhos dentro", () => {
    const [d] = converterBlocos([bloco("toggleListItem", { content: [t("Título")], children: [bloco("paragraph", { content: [t("dentro")] })] })]);
    expect(d!.type).toBe("details");
    expect(d!.content![0]!.type).toBe("detailsSummary");
    expect(d!.content![1]!.content![0]!.content![0]!.text).toBe("dentro");
  });

  it("tabela mantém o cabeçalho (cabeçalho só na primeira linha)", () => {
    const [tab] = converterBlocos([bloco("table", { content: { type: "tableContent", headerRows: 1, rows: [{ cells: [[t("H1")], { content: [t("H2")] }] }, { cells: [[t("a")], [t("b")]] }] } })]);
    expect(tab!.content!.map((r) => r.content!.map((c) => c.type))).toEqual([["tableHeader", "tableHeader"], ["tableCell", "tableCell"]]);
  });

  it("estilos viram marcas e link perigoso vira texto", () => {
    const [p] = converterBlocos([bloco("paragraph", { content: [t("forte", { bold: true, italic: true }), { type: "link", href: "https://x.com", content: [t("bom")] }, { type: "link", href: "javascript:alert(1)", content: [t("ruim")] }] })]);
    const [a, b, c] = p!.content!;
    expect(a!.marks).toEqual([{ type: "bold" }, { type: "italic" }]);
    expect(b!.marks).toEqual([{ type: "link", attrs: { href: "https://x.com" } }]);
    expect(c).toEqual({ type: "text", text: "ruim" });
  });

  it("blocos visuais viram citação/títulos/parágrafos sem perder o texto", () => {
    const doc = lerDocumento([
      bloco("destaque", { content: [t("Cuidado com o prazo")], props: { tom: "atencao" } }),
      bloco("fluxo", { props: { dados: JSON.stringify([{ titulo: "Captar", texto: "anúncios" }, { titulo: "Fechar", texto: "" }]) } }),
      bloco("matriz", { props: { dados: JSON.stringify([{ titulo: "Forças", texto: "Equipe" }]) } }),
      bloco("cartoes", { props: { dados: JSON.stringify([{ titulo: "Plano A", texto: "x" }]) } }),
      bloco("metricas", { props: { dados: JSON.stringify([{ titulo: "128", texto: "Leads" }]) } }),
      bloco("piramide", { props: { dados: JSON.stringify(["Topo", "Base"]) } }),
      bloco("fluxo", { props: { dados: "{não é json" } }),
    ]);
    expect(doc[0]!.type).toBe("blockquote");
    const texto = textoDoDocumento(doc);
    for (const parte of ["Cuidado com o prazo", "Captar", "anúncios", "Fechar", "Forças", "Equipe", "Plano A", "128", "Leads", "Topo", "Base"]) expect(texto).toContain(parte);
  });

  it("mantém subpágina, divisor, citação e código", () => {
    const r = converterBlocos([bloco("subpagina", { props: { pageId: "p1" } }), bloco("divider"), bloco("quote", { content: [t("q")] }), bloco("codeBlock", { content: [t("x = 1")], props: { language: "ts" } })]);
    expect(r.map((n) => n.type)).toEqual(["subpagina", "horizontalRule", "blockquote", "codeBlock"]);
    expect(r[0]!.attrs).toEqual({ pageId: "p1" });
  });
});
