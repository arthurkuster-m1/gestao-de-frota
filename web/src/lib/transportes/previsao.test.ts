import { describe, expect, it } from "vitest";
import type { Checklist } from "../checklists/tipos";
import type { Reserva } from "../eventos/tipos";
import { previsaoFinanceira, transporteExecutado } from "./previsao";
import type { Transporte, VinculoDaReserva } from "./tipos";

const t = (id: string, o: Partial<Transporte>) => ({ id, evento_id: "e", sentido: "ida", modalidade: "pta", valor_planejado: 100, valor_real: null, status_pagamento: "solicitado", data_pagamento: null, ...o }) as Transporte;
const r = (id: string, estado: Reserva["estado"]) => ({ id, evento_id: "e", estado }) as Reserva;
const ck = (reserva_id: string, momento: "saida" | "retorno") => ({ reserva_id, momento }) as Checklist;
const vin = (id: string, ida: string | null, volta: string | null): VinculoDaReserva => ({ id, transporte_ida_id: ida, transporte_volta_id: volta });

describe("transporte executado", () => {
  it("ida = todos os carros com checklist de saída (ou reserva em uso/concluída); volta = checklist de retorno", () => {
    const base = { vinculos: [vin("a", "t1", "t2"), vin("b", "t1", "t2")], reservas: [r("a", "reservado"), r("b", "em_uso")], checklists: [ck("a", "saida")] };
    expect(transporteExecutado(t("t1", {}), base)).toBe(true);
    expect(transporteExecutado(t("t2", { sentido: "volta" }), base)).toBe(false);
    expect(transporteExecutado(t("t1", {}), { ...base, checklists: [] })).toBe(false);
    expect(transporteExecutado(t("t9", {}), base)).toBe(false);   // nenhum carro ligado
  });
});

describe("previsão financeira", () => {
  const vinculos = [vin("a", "t1", "t2"), vin("b", "t3", null)];
  const reservas = [r("a", "em_uso"), r("b", "reservado")];
  it("aprovados e executados entram na previsão; o que ainda não aconteceu e o que já foi pago ficam de fora", () => {
    const transportes = [
      t("t1", { valor_planejado: 1000, status_pagamento: "solicitado" }),                 // executado (ida, carro em uso), não aprovado
      t("t2", { sentido: "volta", valor_planejado: 500, status_pagamento: "aprovado" }),  // aprovado
      t("t3", { valor_planejado: 300 }),                                                  // a executar
      t("t4", { valor_planejado: 700, status_pagamento: "pago" }),                        // pago
      t("t5", { modalidade: "retirada", valor_planejado: 50, status_pagamento: null }),   // retirada: sem pagamento
      t("t6", { modalidade: "tso", valor_planejado: 200, status_pagamento: "aprovado", data_pagamento: "2026-11-01" }),   // NF já paga
    ];
    const p = previsaoFinanceira({ transportes, vinculos, reservas, checklists: [] });
    expect(p.aprovados).toBe(500);
    expect(p.executados).toBe(1000);
    expect(p.aExecutar).toBe(300);
    expect(p.previsao).toBe(1500);
    expect(p.itens.map((i) => i.transporte.id).sort()).toEqual(["t1", "t2", "t3"]);
  });
  it("usa o valor real quando existe e conta os itens sem valor", () => {
    const p = previsaoFinanceira({ transportes: [t("t1", { valor_planejado: 1000, valor_real: 900 }), t("t2", { sentido: "volta", valor_planejado: null, status_pagamento: "aprovado" })], vinculos, reservas, checklists: [] });
    expect(p.previsao).toBe(900);
    expect(p.semValor).toBe(1);
  });
});
