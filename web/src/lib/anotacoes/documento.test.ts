import { describe, expect, it } from "vitest";
import { ajustarCartoes, cartoesDoDocumento, lerDocumento, MAXIMO_DE_BLOCOS_NA_RAIZ, terminarComParagrafo, type Documento } from "./documento";

const paragrafo = (t = ""): Documento[number] => ({ type: "paragraph", ...(t ? { content: [{ type: "text", text: t }] } : {}) });
const cartao = (pageId: string): Documento[number] => ({ type: "subpagina", attrs: { pageId } });

describe("anotações — documento do editor", () => {
  it("lê o formato novo; lixo e o formato da Estratégia (sem type) somem em vez de quebrar", () => {
    expect(lerDocumento([paragrafo("a"), { tipo: "texto", texto: "oi" }, 5, null])).toEqual([paragrafo("a")]);
    expect(lerDocumento("lixo")).toEqual([]);
    expect(lerDocumento(null)).toEqual([]);
  });

  it("converte o formato antigo (blocos com id) ao ler", () => {
    const doc = lerDocumento([{ id: "1", type: "paragraph", props: {}, content: [{ type: "text", text: "Oi", styles: {} }], children: [] }]);
    expect(doc).toEqual([{ type: "paragraph", content: [{ type: "text", text: "Oi" }] }]);
  });

  it("corta o que passa do teto de nós na raiz", () => {
    const muitos = Array.from({ length: MAXIMO_DE_BLOCOS_NA_RAIZ + 10 }, () => paragrafo("x"));
    expect(lerDocumento(muitos)).toHaveLength(MAXIMO_DE_BLOCOS_NA_RAIZ);
  });

  it("lista as subpáginas citadas na ordem do texto, também dentro de outros nós", () => {
    const doc: Documento = [cartao("p2"), { type: "details", content: [{ type: "detailsSummary" }, { type: "detailsContent", content: [cartao("p1")] }] }, cartao("p3")];
    expect(cartoesDoDocumento(doc)).toEqual(["p2", "p1", "p3"]);
  });

  it("ajusta os cartões à árvore: tira o que não é mais filha, o repetido, e acrescenta o que falta no fim", () => {
    const ajustado = ajustarCartoes([cartao("p1"), paragrafo("t"), cartao("p1"), cartao("fora")], ["p1", "p2"]);
    expect(cartoesDoDocumento(ajustado)).toEqual(["p1", "p2"]);
    expect(ajustado.some((b) => b.type === "paragraph")).toBe(true);
    expect(ajustado[ajustado.length - 1]!.type).toBe("subpagina");
  });

  it("sem filhas, não deixa cartão nenhum", () => {
    expect(cartoesDoDocumento(ajustarCartoes([cartao("a")], []))).toEqual([]);
  });

  it("termina sempre com um parágrafo vazio (e não duplica)", () => {
    const com = terminarComParagrafo([cartao("a")]);
    expect(com[com.length - 1]).toEqual({ type: "paragraph" });
    expect(terminarComParagrafo(com)).toBe(com);
    expect(terminarComParagrafo([])).toEqual([{ type: "paragraph" }]);
  });
});
