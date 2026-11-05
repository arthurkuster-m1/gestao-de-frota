import { describe, expect, it } from "vitest";
import { aplicarConsulta, filtrar, ordenar, agrupar, intervaloDoPeriodo, resolverData, valoresDeNascimento, type CampoConsultavel } from "./consulta";
import { alternarVisibilidade, moverColuna, resolverColunas } from "./layout";
import { proximaOrdenacao } from "./ordenar-por-coluna";
import { diaDaSemanaDaChave, diasDaSemana, somarDias } from "./datas";
import { configSegura } from "./visoes";

type V = { id: string; modelo: string; ciclo: string | null; blindado: boolean; faturado: string | null; tags: string[] };
const linhas: V[] = [
  { id: "1", modelo: "Onix RS", ciclo: "disponivel", blindado: false, faturado: "2026-01-10", tags: ["a"] },
  { id: "2", modelo: "S10 Trailboss", ciclo: "gravame", blindado: true, faturado: null, tags: [] },
  { id: "3", modelo: "Tracker", ciclo: "disponivel", blindado: true, faturado: "2025-06-01", tags: ["a", "b"] },
  { id: "4", modelo: "Cruze", ciclo: null, blindado: false, faturado: "2026-03-05", tags: [] },
];
const ORDEM = ["disponivel", "gravame"];
const campos: CampoConsultavel<V>[] = [
  { id: "modelo", tipo: "texto", valorDe: (v) => v.modelo },
  { id: "ciclo", tipo: "opcao", valorDe: (v) => v.ciclo, ordemDoValor: (x) => ORDEM.indexOf(x), rotuloDoValor: (x) => x },
  { id: "blindado", tipo: "caixa", valorDe: (v) => v.blindado },
  { id: "faturado", tipo: "data", valorDe: (v) => v.faturado },
  { id: "tags", tipo: "multi", valorDe: (v) => v.tags },
];
const ctx = { hoje: "2026-11-05" }; // quinta-feira
const ids = (l: V[]) => l.map((x) => x.id).join(",");

describe("filtrar", () => {
  it("texto contém, ignorando acento e caixa", () => { expect(ids(filtrar(linhas, campos, [{ campo: "modelo", operador: "contem", valor: "trailbóss" }], ctx))).toBe("2"); });
  it("opção 'é' (vários valores) e 'não é'", () => {
    expect(ids(filtrar(linhas, campos, [{ campo: "ciclo", operador: "e", valor: ["disponivel", "gravame"] }], ctx))).toBe("1,2,3");
    expect(ids(filtrar(linhas, campos, [{ campo: "ciclo", operador: "nao_e", valor: ["disponivel"] }], ctx))).toBe("2,4");
  });
  it("vazio / preenchido / caixa", () => {
    expect(ids(filtrar(linhas, campos, [{ campo: "ciclo", operador: "vazio" }], ctx))).toBe("4");
    expect(ids(filtrar(linhas, campos, [{ campo: "blindado", operador: "marcado" }], ctx))).toBe("2,3");
  });
  it("data: antes de / período relativo", () => {
    expect(ids(filtrar(linhas, campos, [{ campo: "faturado", operador: "antes", valor: "2026-01-01" }], ctx))).toBe("3");
    expect(ids(filtrar(linhas, campos, [{ campo: "faturado", operador: "periodo", valor: "este_mes" }], ctx))).toBe("");
    expect(ids(filtrar(linhas, campos, [{ campo: "faturado", operador: "periodo", valor: "ultimos_30_dias" }], { hoje: "2026-03-20" }))).toBe("4");
  });
  it("E prende mais que OU: A e B ou C = (A e B) ou C", () => {
    const f = [{ campo: "blindado", operador: "marcado" as const }, { campo: "ciclo", operador: "e" as const, valor: ["disponivel"] }, { campo: "modelo", operador: "contem" as const, valor: "cruze", juncao: "ou" as const }];
    expect(ids(filtrar(linhas, campos, f, ctx))).toBe("3,4");
  });
  it("filtro de campo que não existe mais, ou sem valor, é ignorado (nunca quebra)", () => {
    expect(ids(filtrar(linhas, campos, [{ campo: "apagado", operador: "contem", valor: "x" }, { campo: "modelo", operador: "contem", valor: "  " }], ctx))).toBe("1,2,3,4");
  });
});

describe("ordenar e agrupar", () => {
  it("vazios sempre no fim, nas duas direções", () => {
    expect(ids(ordenar(linhas, campos, [{ campo: "faturado", direcao: "asc" }]))).toBe("3,1,4,2");
    expect(ids(ordenar(linhas, campos, [{ campo: "faturado", direcao: "desc" }]))).toBe("4,1,3,2");
  });
  it("opção ordena pela posição da lista fixa; empate mantém a ordem de entrada", () => {
    expect(ids(ordenar(linhas, campos, [{ campo: "ciclo", direcao: "asc" }]))).toBe("1,3,2,4");
  });
  it("agrupa com 'sem valor' por último e multi entra em um grupo por valor", () => {
    const g = agrupar(linhas, campos.find((c) => c.id === "ciclo"))!;
    expect(g.map((x) => x.chave)).toEqual(["disponivel", "gravame", ""]);
    const t = agrupar(linhas, campos.find((c) => c.id === "tags"))!;
    expect(t.find((x) => x.chave === "a")!.linhas).toHaveLength(2);
  });
  it("pipeline completo", () => {
    const r = aplicarConsulta(linhas, campos, { filtros: [{ campo: "blindado", operador: "marcado" }], ordenacao: [{ campo: "modelo", direcao: "desc" }], agrupar: "ciclo" }, ctx);
    expect(ids(r.linhas)).toBe("3,2"); expect(r.grupos!.map((g) => g.chave)).toEqual(["disponivel", "gravame"]);
  });
});

describe("datas relativas", () => {
  it("semana de segunda a domingo", () => {
    expect(diaDaSemanaDaChave("2026-11-05")).toBe(3); expect(diasDaSemana("2026-11-05")[0]).toBe("2026-11-02"); expect(somarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(intervaloDoPeriodo("esta_semana", "2026-11-05")).toEqual({ de: "2026-11-02", ate: "2026-11-08" });
    expect(resolverData("fim_do_mes", "2026-02-10")).toBe("2026-02-28");
  });
  it("linha nova já nasce passando nos filtros ligados", () => {
    expect(valoresDeNascimento([{ campo: "ciclo", operador: "e", valor: ["gravame"] }, { campo: "blindado", operador: "marcado" }], campos, ctx)).toEqual({ ciclo: "gravame", blindado: true });
  });
});

describe("colunas", () => {
  const defs = [{ id: "codigo", largura: 160, fixa: true }, { id: "placa", largura: 110 }, { id: "vin", largura: 190 }, { id: "cor", largura: 110, padrao: false }];
  it("fábrica: ordem declarada, escondida respeita padrao:false", () => {
    expect(resolverColunas(defs, undefined).filter((c) => c.visivel).map((c) => c.id)).toEqual(["codigo", "placa", "vin"]);
  });
  it("coluna nova da tela entra no fim sem migrar preferências antigas; larguras limitadas", () => {
    const r = resolverColunas(defs, { ordem: ["vin", "placa"], larguras: { vin: 5000 } });
    expect(r.map((c) => c.id)).toEqual(["codigo", "vin", "placa", "cor"]); expect(r[1]!.largura).toBe(900);
  });
  it("ligar uma propriedade a põe logo depois da última visível; desligar manda para o fim", () => {
    const r1 = resolverColunas(defs, {});
    const lig = alternarVisibilidade({}, r1, "cor");
    expect(lig.ordem).toEqual(["placa", "vin", "cor"]);
    const des = alternarVisibilidade({}, resolverColunas(defs, lig), "placa");
    expect(des.ordem).toEqual(["vin", "cor", "placa"]);
    expect(moverColuna(["placa", "vin", "cor"], "cor", "placa")).toEqual(["cor", "placa", "vin"]);
  });
  it("a coluna fixa não se desliga", () => { expect(alternarVisibilidade({}, resolverColunas(defs, {}), "codigo")).toEqual({}); });
});

describe("ordenar pelo título da coluna", () => {
  it("1º clique cresce, 2º decresce, 3º tira", () => {
    const a = proximaOrdenacao(undefined, "placa")!; expect(a).toEqual([{ campo: "placa", direcao: "asc" }]);
    const b = proximaOrdenacao(a, "placa")!; expect(b).toEqual([{ campo: "placa", direcao: "desc" }]);
    expect(proximaOrdenacao(b, "placa")).toBeUndefined();
  });
});

describe("config salva", () => {
  it("config inválida vira vazia, nunca derruba a tela", () => { expect(configSegura({ filtros: "lixo" })).toEqual({}); expect(configSegura(null)).toEqual({}); });
  it("config válida passa, inclusive colunas congeladas", () => { expect(configSegura({ congelar: 2, visualizacao: "tabela" })).toEqual({ congelar: 2, visualizacao: "tabela" }); });
});

import { prefsIguais } from "./prefs";
describe("prefsIguais", () => {
  it("lista vazia e undefined são a mesma coisa; ordem das chaves não importa", () => {
    expect(prefsIguais({}, { filtros: [], ordenacao: [] })).toBe(true);
    expect(prefsIguais({ congelar: 2, ordem: ["a"] }, { ordem: ["a"], congelar: 2 })).toBe(true);
  });
  it("filtro novo, ordem e largura contam como mudança", () => {
    expect(prefsIguais({}, { filtros: [{ campo: "a", operador: "vazio" }] })).toBe(false);
    expect(prefsIguais({ larguras: { a: 100 } }, { larguras: { a: 120 } })).toBe(false);
  });
});
