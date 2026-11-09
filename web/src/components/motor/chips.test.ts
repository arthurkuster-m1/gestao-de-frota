import { describe, expect, it } from "vitest";
import { filtrarPorChips, mover, type ConfigDeChips } from "./ChipsRapidos";
import { partirModelo } from "../../lib/veiculos/modelo";

const cfg: ConfigDeChips<{ m: string }> = { id: "x", rotulo: "X", semValor: "—", niveis: [{ rotulo: "M", valorDe: (l) => partirModelo(l.m).mae }, { rotulo: "V", valorDe: (l) => partirModelo(l.m).versao }] };
const L = [{ m: "Onix RS" }, { m: "onix Premier" }, { m: "S10 High Country" }, { m: "S10" }];

describe("chips rápidas", () => {
  it("sem escolha mostra tudo; mãe filtra sem diferenciar caixa; versão afina", () => {
    expect(filtrarPorChips(L, cfg, [null, null])).toHaveLength(4);
    expect(filtrarPorChips(L, cfg, ["onix", null])).toHaveLength(2);
    expect(filtrarPorChips(L, cfg, ["s10", "high country"])).toEqual([{ m: "S10 High Country" }]);
    expect(filtrarPorChips(L, cfg, ["s10", ""])).toEqual([{ m: "S10" }]);
  });
  it("mover reordena", () => {
    expect(mover(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(mover(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  });
});
