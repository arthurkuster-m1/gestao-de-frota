import { describe, expect, it } from "vitest";
import { linhasDeMatriz, validarTudo, type Existentes } from "./importacao";
import { normalizarPlaca } from "./tipos";

const nada = (): Existentes => ({ vins: new Set(), placas: new Set() });
const VIN = "9BGKS48X0NG123456";

describe("linhasDeMatriz", () => {
  it("usa o cabeçalho quando reconhece as colunas (com acento e apelidos)", () => {
    const l = linhasDeMatriz([["Modelo", "Chassi", "Status", "Cor"], ["Onix", VIN, "Liberado", "Branco"]]);
    expect(l).toEqual([{ modelo: "Onix", vin: VIN, ciclo: "Liberado", cor: "Branco" }]);
  });
  it("sem cabeçalho, assume a ordem modelo, cor, MY, pedido, VIN, placa…", () => {
    const l = linhasDeMatriz([["Onix PR", "Preto", "2026", "P-1", VIN, "ABC1D23"]]);
    expect(l[0]).toMatchObject({ modelo: "Onix PR", cor: "Preto", my: "2026", pedido: "P-1", vin: VIN, placa: "ABC1D23" });
  });
  it("junta a coluna Versão ao modelo (o app tem um campo só)", () => {
    expect(linhasDeMatriz([["Modelo", "Versão", "Cor"], ["Onix", "RS", "Preto"], ["S10", "", "Azul"]])).toEqual([{ modelo: "Onix RS", cor: "Preto" }, { modelo: "S10", cor: "Azul" }]);
  });
  it("ignora linhas totalmente vazias", () => { expect(linhasDeMatriz([["", ""], ["Onix"]])).toHaveLength(1); });
});

describe("validarTudo", () => {
  it("o pedido recém-recebido só tem modelo, cor, MY e pedido (sem VIN nem placa)", () => {
    const [r] = validarTudo([{ modelo: "Tracker", cor: "Azul", my: "2027", pedido: "123" }], nada());
    expect(r.tom).toBe("ok");
    expect(r.veiculo).toMatchObject({ vin: null, placa: null, status_ciclo: "pedido_recebido", seguro_status: "pendente", blindado: false });
  });
  it("normaliza placa e VIN e entende ciclo pelo nome", () => {
    const [r] = validarTudo([{ modelo: "Onix", vin: VIN.toLowerCase(), placa: "abc-1d23", ciclo: "Em transporte 0 km", blindado: "Sim", seguro: "cadastrado" }], nada());
    expect(r.veiculo).toMatchObject({ vin: VIN, placa: "ABC1D23", status_ciclo: "em_transporte_0km", blindado: true, seguro_status: "cadastrado" });
    expect(normalizarPlaca("abc-1d23")).toBe("ABC1D23");
  });
  it("recusa com mensagem clara", () => {
    const r = validarTudo([{ placa: "X" }, { modelo: "Onix", vin: "curto" }, { modelo: "Onix", placa: "ABC12" }, { modelo: "Onix", blindado: "talvez" }, { modelo: "Onix", ciclo: "inventado" }], nada());
    expect(r.map((x) => x.tom)).toEqual(["erro", "erro", "erro", "erro", "erro"]);
    expect(r[0].texto).toMatch(/modelo/i); expect(r[1].texto).toMatch(/VIN/); expect(r[2].texto).toMatch(/Placa/);
  });
  it("já cadastrado vira 'dup' (ignorada) e repetido dentro da tabela é erro", () => {
    const ex = nada(); ex.vins.add(VIN);
    const r = validarTudo([{ modelo: "Onix", vin: VIN }, { modelo: "Tracker", placa: "ABC1D23" }, { modelo: "Tracker", placa: "ABC1D23" }], ex);
    expect(r.map((x) => x.tom)).toEqual(["dup", "ok", "erro"]);
  });
  it("linha vazia é ignorada", () => { expect(validarTudo([{}], nada())[0].tom).toBe("ign"); });
});
