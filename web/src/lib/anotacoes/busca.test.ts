import { describe, expect, it } from "vitest";

import {
  camposDeBusca,
  dobrar,
  termoDeBusca,
  textoDoDocumento,
  trechoDaBusca,
} from "./busca";

describe("anotações — busca", () => {
  it("dobra para minúsculas sem acento, mantendo o comprimento", () => {
    expect(dobrar("Reunião de AÇÃO — Ñandú")).toBe("reuniao de acao — nandu");
    expect(dobrar("ção").length).toBe(3);
  });

  it("limpa o termo digitado dos caracteres que quebram o filtro", () => {
    expect(termoDeBusca('  Preço%_(final), "x"  ')).toBe("preco final x");
    expect(termoDeBusca("a".repeat(200))).toHaveLength(80);
  });

  it("extrai o texto de parágrafos, links, listas, tabelas, toggles e quebras", () => {
    const tx = (text: string, marks?: unknown[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });
    const doc = [
      { type: "paragraph", content: [tx("Briefing do cliente")] },
      { type: "paragraph", content: [tx("site oficial", [{ type: "link", attrs: { href: "https://x.com" } }])] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [tx("item da lista")] }] }] },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [tx("Canal")] }] }, { type: "tableCell", content: [{ type: "paragraph", content: [tx("Instagram")] }] }] }] },
      { type: "details", content: [{ type: "detailsSummary", content: [tx("Resumo")] }, { type: "detailsContent", content: [{ type: "paragraph", content: [tx("escondido")] }] }] },
      { type: "subpagina", attrs: { pageId: "x" } },
    ];
    const texto = textoDoDocumento(doc);
    for (const parte of ["Briefing do cliente", "site oficial", "item da lista", "Canal", "Instagram", "Resumo", "escondido"]) expect(texto).toContain(parte);
    expect(texto.split("\n").length).toBe(7);
  });

  it("monta os três campos de busca", () => {
    const c = camposDeBusca("Reunião", [
      { type: "paragraph", content: [{ type: "text", text: "Orçamento aprovado" }] },
    ]);
    expect(c.title_fold).toBe("reuniao");
    expect(c.search_text).toBe("Orçamento aprovado");
    expect(c.search_fold).toBe("orcamento aprovado");
  });

  it("devolve um trecho em volta do termo, com o texto original", () => {
    const texto = `${"a ".repeat(60)}Orçamento aprovado ${"b ".repeat(60)}`;
    const trecho = trechoDaBusca(texto, "orcamento");
    expect(trecho).toContain("Orçamento aprovado");
    expect(trecho.startsWith("…")).toBe(true);
    expect(trecho.endsWith("…")).toBe(true);
    expect(trechoDaBusca("curto", "xyz")).toBe("curto");
  });
});
