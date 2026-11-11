import { describe, expect, it } from "vitest";
import { LANCAMENTOS_DE_VEICULOS } from "./veiculos";

const l = LANCAMENTOS_DE_VEICULOS.find((x) => x.id === "comentario")!;
const v = (id: string, o: object) => ({ id, codigo: id.toUpperCase(), modelo: "Onix", vin: null, placa: null, pedido: null, comentarios: null, ...o });
const d = { veiculos: [v("a", { pedido: "P1", comentarios: "antigo" }), v("b", { placa: "ABC1D23" })] } as never;

describe("lançamento: atualizar comentário", () => {
  it("usa o comentário da linha ou o geral; acha por pedido/placa/código", () => {
    const r = l.validar([{ ref: "P1", comentario: "novo" }, { ref: "ABC1D23" }, { ref: "x" }, { ref: "a" }, {}], d, { comentario: "geral", modo: "substituir" });
    expect(r.map((x) => x.tom)).toEqual(["ok", "ok", "erro", "erro", "ign"]);   // 4ª repete o carro "a"
    expect((r[0]!.pronto as { comentarios: string }).comentarios).toBe("novo");
    expect((r[1]!.pronto as { comentarios: string }).comentarios).toBe("geral");
  });
  it("acrescentar junta ao comentário que já existe; sem comentário nenhum é erro", () => {
    expect((l.validar([{ ref: "a", comentario: "mais" }], d, { modo: "acrescentar" })[0]!.pronto as { comentarios: string }).comentarios).toBe("antigo\nmais");
    expect(l.validar([{ ref: "a" }], d, {})[0]!.tom).toBe("erro");
  });
});
