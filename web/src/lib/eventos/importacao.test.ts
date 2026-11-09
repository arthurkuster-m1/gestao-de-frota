import { describe, expect, it } from "vitest";
import { agruparEventos, lerData, linhasDeMatriz, separarVeiculos, validarTudo, type Contexto } from "./importacao";

const ctx: Contexto = {
  veiculos: [{ id: "v1", codigo: "ONIX RS 2412", placa: "ABC1D23", vin: "12345678901234567", modelo: "Onix RS" }, { id: "v2", codigo: "S10 TRAILBOSS 9999", placa: "XYZ9K88", vin: null, modelo: "S10 TRAILBOSS" }],
  clientes: [{ id: "c1", nome: "Chevrolet Brasil" }], nomesDeEventos: ["Evento Velho"], hoje: "2026-11-09",
};
const END = "Rua Araci, 583 - Santo André/SP - CEP 09090-123";

describe("importação de eventos", () => {
  it("datas: br, curta e iso; inexistente é erro", () => { expect(lerData("05/11/2026")).toBe("2026-11-05"); expect(lerData("5/1/26")).toBe("2026-01-05"); expect(lerData("2026-11-05")).toBe("2026-11-05"); expect(lerData("31/02/2026")).toBe("x"); expect(lerData("")).toBeNull(); });
  it("vários carros numa célula só: ; , ou quebra de linha", () => expect(separarVeiculos("ONIX RS 2412; abc1d23,\nS10 TRAILBOSS 9999")).toEqual(["ONIX RS 2412", "abc1d23", "S10 TRAILBOSS 9999"]));
  it("cabeçalho reconhecido monta as linhas", () => {
    const l = linhasDeMatriz([["Evento", "Cliente", "Início", "Fim", "Carros"], ["Convenção", "Chevrolet Brasil", "01/11/2026", "05/11/2026", "ONIX RS 2412; XYZ9K88"]]);
    expect(l).toEqual([{ titulo: "Convenção", cliente: "Chevrolet Brasil", chegada: "01/11/2026", retirada: "05/11/2026", veiculos: "ONIX RS 2412; XYZ9K88" }]);
  });
  it("linha boa: acha carros por código, placa e VIN; cliente; endereço na máscara", () => {
    const [r] = validarTudo([{ titulo: "Convenção", cliente: "chevrolet brasil", chegada: "01/11/2026", retirada: "05/11/2026", endereco: END, veiculos: "ONIX RS 2412; XYZ9K88; 12345678901234567" }], ctx);
    expect(r!.tom).toBe("ok");
    expect(r!.evento!.veiculoIds).toEqual(["v1", "v2"]);   // o VIN repete o carro v1: entra uma vez
    expect(r!.evento!.cliente_id).toBe("c1");
  });
  it("erros: carro, cliente, data, endereço fora da máscara, carros sem datas", () => {
    const t = (l: object) => validarTudo([l], ctx)[0]!;
    expect(t({ titulo: "A", veiculos: "NADA 0000", chegada: "01/11/2026", retirada: "02/11/2026" }).texto).toContain("Veículo não encontrado");
    expect(t({ titulo: "A", cliente: "Quem?" }).texto).toContain("Cliente não cadastrado");
    expect(t({ titulo: "A", chegada: "32/13/2026" }).texto).toContain("inválida");
    expect(t({ titulo: "A", retirada: "01/11/2026", chegada: "05/11/2026" }).texto).toContain("antes da chegada");
    expect(t({ titulo: "A", endereco: "Rua X, 1" }).texto).toContain("fora do formato");
    expect(t({ titulo: "A", veiculos: "ONIX RS 2412" }).texto).toContain("informe a chegada e a retirada");
  });
  it("título já existente é ignorado; sem título vira EVENTO DIA …; título repetido soma carros", () => {
    const r = validarTudo([{ titulo: "evento velho" }, { solicitante: "Maria", chegada: "05/11/2026" }, { titulo: "Feira", veiculos: "ONIX RS 2412", chegada: "01/11/2026", retirada: "02/11/2026" }, { titulo: "feira", veiculos: "XYZ9K88", chegada: "01/11/2026", retirada: "02/11/2026" }], ctx);
    expect(r.map((x) => x.tom)).toEqual(["dup", "ok", "ok", "ok"]);
    expect(r[1]!.evento!.nome).toBe("EVENTO DIA 05/11 - MARIA");
    expect(r[3]!.texto).toContain("Soma");
    const g = agruparEventos(r.flatMap((x) => (x.evento ? [x.evento] : [])));
    expect(g.map((e) => [e.nome, e.veiculoIds.length])).toEqual([["EVENTO DIA 05/11 - MARIA", 0], ["Feira", 2]]);
  });
});
