import { describe, expect, it } from "vitest";
import { analisarMatriz, linhasDeMatriz, validarTudo, type Existentes } from "./importacao";
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

describe("colunas extras (datas) e ordem das colunas", () => {
  const ex = { vins: new Set<string>(), placas: new Set<string>() };
  it("reconhece o cabeçalho das datas e devolve quais colunas vieram", () => {
    const r = analisarMatriz([["Modelo", "Data de Faturamento", "Emplacamento"], ["Onix", "10/11/2026", "2026-11-12"]]);
    expect(r.campos).toEqual(["modelo", "data_faturamento", "data_emplacamento"]);
    expect(r.linhas[0]).toEqual({ modelo: "Onix", data_faturamento: "10/11/2026", data_emplacamento: "2026-11-12" });
  });
  it("sem cabeçalho, vale a ordem das colunas que estão na tabela", () => {
    const r = analisarMatriz([["Onix", "10/11/2026", "Preto"]], ["modelo", "data_faturamento", "cor"]);
    expect(r.linhas[0]).toEqual({ modelo: "Onix", data_faturamento: "10/11/2026", cor: "Preto" });
  });
  it("as datas válidas vão para o veículo (em ISO) e a inválida é erro", () => {
    const ok = validarTudo([{ modelo: "Onix", data_faturamento: "10/11/2026", data_liberacao: "2026-11-01" }], ex)[0]!;
    expect(ok.tom).toBe("ok");
    expect(ok.veiculo).toMatchObject({ data_faturamento: "2026-11-10", data_liberacao: "2026-11-01" });
    expect(ok.veiculo).not.toHaveProperty("data_pedido");
    const ruim = validarTudo([{ modelo: "Onix", data_emplacamento: "31/02/2026" }], ex)[0]!;
    expect(ruim.tom).toBe("erro");
    expect(ruim.texto).toMatch(/Data de emplacamento inválida/);
  });
});

describe("importação: número do pedido", () => {
  const ex = { vins: new Set<string>(), placas: new Set<string>(), pedidos: new Set(["ped-1"]) };
  it("sem VIN nem placa, pedido já cadastrado (ou repetido na tabela) vira 'já cadastrado'", () => {
    const r = validarTudo([{ modelo: "Onix", pedido: " PED-1 " }, { modelo: "Onix", pedido: "PED-2" }, { modelo: "Onix", pedido: "ped-2" }], ex);
    expect(r.map((x) => x.tom)).toEqual(["dup", "ok", "dup"]);
  });
  it("com VIN ou placa, o pedido não decide", () => {
    expect(validarTudo([{ modelo: "Onix", pedido: "PED-1", vin: "9BGEY69H0VG100355" }], ex)[0]!.tom).toBe("ok");
  });
});
