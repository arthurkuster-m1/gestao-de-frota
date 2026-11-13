import { describe, expect, it } from "vitest";
import { linkSeguro, PROFUNDIDADE_MAXIMA, sanear } from "./sanear";

describe("anotações — sanear", () => {
  it("abre nó desconhecido (o conteúdo fica) e tira marca desconhecida", () => {
    const r = sanear([{ type: "caixaMisteriosa", content: [{ type: "paragraph", content: [{ type: "text", text: "fica", marks: [{ type: "bold" }, { type: "glitter" }] }] }] }]);
    expect(r).toEqual([{ type: "paragraph", content: [{ type: "text", text: "fica", marks: [{ type: "bold" }] }] }]);
  });

  it("só aceita http, https, mailto e tel nos links", () => {
    expect(linkSeguro("https://a.com")).toBe(true);
    expect(linkSeguro("mailto:a@b.com")).toBe(true);
    expect(linkSeguro("tel:+5511999999999")).toBe(true);
    expect(linkSeguro("javascript:alert(1)")).toBe(false);
    expect(linkSeguro("java\tscript:alert(1)")).toBe(false);
    expect(linkSeguro("data:text/html,x")).toBe(false);
    const r = sanear([{ type: "paragraph", content: [{ type: "text", text: "clique", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }]);
    expect(r[0]!.content![0]).toEqual({ type: "text", text: "clique" });
  });

  it("limita o título a 1–3", () => {
    const nivel = (n: unknown) => (sanear([{ type: "heading", attrs: { level: n }, content: [{ type: "text", text: "T" }] }])[0]!.attrs!.level);
    expect(nivel(6)).toBe(3);
    expect(nivel(0)).toBe(1);
    expect(nivel("x")).toBe(1);
    expect(nivel(2)).toBe(2);
  });

  it("limita a profundidade e descarta texto vazio e cartão sem página", () => {
    let no: unknown = { type: "paragraph", content: [{ type: "text", text: "fundo" }] };
    for (let i = 0; i < PROFUNDIDADE_MAXIMA + 5; i++) no = { type: "blockquote", content: [no] };
    expect(JSON.stringify(sanear([no]))).toContain("fundo");
    expect(sanear([{ type: "paragraph", content: [{ type: "text", text: "" }] }])).toEqual([{ type: "paragraph" }]);
    expect(sanear([{ type: "subpagina", attrs: {} }])).toEqual([]);
  });
});
