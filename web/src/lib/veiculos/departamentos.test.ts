import { describe, expect, it } from "vitest";
import { mesclarDepartamentos } from "./departamentos";

describe("departamentos", () => {
  it("Marketing é sempre o primeiro; os de sempre completam a lista", () => {
    const l = mesclarDepartamentos([{ id: "1", nome: "Eventos Especiais" }]);
    expect(l[0]!.nome).toBe("Marketing");
    expect(l.map((d) => d.nome)).toEqual(expect.arrayContaining(["Eventos Especiais", "RP", "UC", "Acessórios", "Outro"]));
  });
  it("com lista no banco, um de sempre apagado não volta", () => {
    const l = mesclarDepartamentos([{ id: "1", nome: "Marketing" }, { id: "2", nome: "RP" }], new Set(["rp", "uc", "outro", "acessórios", "marketing"]));
    expect(l.map((d) => d.nome)).toEqual(["Marketing", "RP"]);
  });
});
