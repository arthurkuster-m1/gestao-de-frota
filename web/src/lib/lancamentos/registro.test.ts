import { describe, expect, it } from "vitest";
import { GRUPOS, LANCAMENTOS, lancamentoDe } from "./registro";
import type { Dados } from "./tipos";

const d = {
  hoje: "2026-11-12", clientes: [{ id: "c1", nome: "Chevrolet Brasil" }], checklists: [], transportes: [],
  veiculos: [{ id: "v1", codigo: "ONIX RS 1111", placa: "ABC1D23", vin: "11111111111111111", modelo: "Onix", status_ciclo: "disponivel_sem_faturamento", pedido: "P1", blindado: false }],
  eventos: [{ id: "e1", nome: "Feira", status: "planejado", tipo: null, solicitante: null, contato: null }],
  reservas: [],
  manutencoes: [{ id: "m1", veiculo_id: "v1", nome: "Batida", status: "solicitar_da", data_inicio: "2026-11-01", data_fim: null, bloqueia_uso: true }],
} as unknown as Dados;

describe("lançamentos: registro", () => {
  it("todos os grupos têm lançamentos, ids únicos e as colunas de opção trazem as opções", () => {
    expect(new Set(LANCAMENTOS.map((l) => l.id)).size).toBe(LANCAMENTOS.length);
    for (const g of GRUPOS) expect(LANCAMENTOS.some((l) => l.grupo === g)).toBe(true);
    expect(lancamentoDe("atualizar-manutencao")!.colunas(d).find((c) => c.id === "status")!.opcoes!.length).toBe(3);
    expect(lancamentoDe("novo-evento")!.colunas(d).find((c) => c.id === "cliente")!.opcoes).toEqual([{ value: "Chevrolet Brasil", label: "Chevrolet Brasil" }]);
    expect(lancamentoDe("reserva")!.colunas(d).find((c) => c.id === "evento")!.opcoes).toEqual([{ value: "e1", label: "Feira" }]);
  });
  it("faturamento: data por linha ou padrão", () => {
    const l = lancamentoDe("faturamento")!;
    const r = l.validar([{ ref: "11111111111111111" }, { ref: "ONIX RS 1111", data: "xx" }], d, { data: "2026-11-12" });
    expect(r[0]!.tom).toBe("ok"); expect(r[1]!.tom).toBe("erro");
  });
  it("atualizar manutenção: acha a manutenção em aberto do carro e muda o status", () => {
    const l = lancamentoDe("atualizar-manutencao")!;
    const r = l.validar([{ ref: "ABC1D23", status: "em_reparo" }, { ref: "ABC1D23", status: "solicitar_da" }, { ref: "nada" }], d, {});
    expect(r.map((x) => x.tom)).toEqual(["ok", "dup", "erro"]);
    expect(r[0]!.pronto).toMatchObject({ id: "m1", patch: { status: "em_reparo" } });
  });
  it("nova manutenção: exige nome, usa hoje sem início e bloqueia o uso por padrão", () => {
    const l = lancamentoDe("nova-manutencao")!;
    const r = l.validar([{ ref: "ONIX RS 1111", nome: "Pneus", tipo: "Pneus" }, { ref: "ONIX RS 1111" }], d, {});
    expect(r.map((x) => x.tom)).toEqual(["ok", "erro"]);
    expect(r[0]!.pronto).toMatchObject({ veiculo_id: "v1", data_inicio: "2026-11-12", bloqueia_uso: true, status: "solicitar_da" });
  });
  it("atualizar evento: status e tipo por título; repetido, sem mudança e inexistente são avisados", () => {
    const l = lancamentoDe("atualizar-evento")!;
    expect(l.validar([{ ref: "feira", status: "em_uso", tipo: "Evento" }, { ref: "feira", tipo: "Evento" }, { ref: "quem?" }], d, {}).map((x) => x.tom)).toEqual(["ok", "erro", "erro"]);   // o 2º repete o evento
    expect(l.validar([{ ref: "Feira", status: "planejado" }], d, {})[0]!.tom).toBe("dup");                                                                                             // já está planejado
  });
});
