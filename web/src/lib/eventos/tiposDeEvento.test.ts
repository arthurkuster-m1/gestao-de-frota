import { describe, expect, it } from "vitest";
import { eventoSemRetorno, mesclarTipos } from "./tiposDeEvento";

describe("tipos de evento", () => {
  it("o banco manda sobre os tipos de sempre e os novos entram na frente", () => {
    const l = mesclarTipos([{ id: "1", nome: "Feira sem volta", semRetorno: true }, { id: "2", nome: "evento", semRetorno: true }]);
    expect(l.map((t) => t.nome).slice(0, 2)).toEqual(["Feira sem volta", "evento"]);
    expect(l.filter((t) => t.nome.toLowerCase() === "evento")).toHaveLength(1);
    expect(l.some((t) => t.nome === "Gravação")).toBe(true);
    expect(eventoSemRetorno("EVENTO", l)).toBe(true);
    expect(eventoSemRetorno("Gravação", l)).toBe(false);
    expect(eventoSemRetorno(null, l)).toBe(false);
  });
});
