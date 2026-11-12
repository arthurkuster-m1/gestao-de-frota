import { describe, expect, it } from "vitest";
import { planoDeRestauracao, posicaoNoFim, raizesDaLixeira } from "./acoes";
import type { ResumoDaNota } from "./paginas";

const n = (id: string, parent: string | null, position = 1, deleted_at: string | null = null): ResumoDaNota => ({ id, parent_id: parent, title: id, icon: null, position, kind: null, deleted_at, updated_at: "" });

describe("anotações — ações da árvore", () => {
  it("página nova vai para o fim das irmãs (a lixeira não conta)", () => {
    expect(posicaoNoFim([n("a", null, 3), n("b", null, 5, "2026-01-01"), n("c", "a", 9)], null)).toBe(4);
    expect(posicaoNoFim([], null)).toBe(1);
  });
  it("restaurar leva quem foi apagado no mesmo instante; mãe ainda apagada manda para a raiz", () => {
    const l = [n("a", null, 1, "T1"), n("a1", "a", 1, "T1"), n("a2", "a", 2, "T0")];
    expect(planoDeRestauracao(l, "a")).toEqual({ ids: expect.arrayContaining(["a", "a1"]), paraARaiz: false });
    expect(planoDeRestauracao(l, "a").ids).not.toContain("a2");
    expect(planoDeRestauracao(l, "a1").paraARaiz).toBe(true);
    expect(planoDeRestauracao([n("x", null)], "x")).toEqual({ ids: [], paraARaiz: false });
  });
  it("a lixeira mostra só a raiz de cada exclusão, a mais recente primeiro", () => {
    const l = [n("a", null, 1, "2026-01-01"), n("a1", "a", 1, "2026-01-01"), n("b", null, 1, "2026-02-01"), n("vivo", null)];
    expect(raizesDaLixeira(l).map((x) => x.id)).toEqual(["b", "a"]);
  });
});
