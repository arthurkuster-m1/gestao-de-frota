import { describe, expect, it } from "vitest";
import { diasAte, fatosDosEventos, statusAutomatico, type FatosDoEvento } from "./automacaoDeStatus";
import type { Evento, ReservaDoEvento, StatusEvento } from "./tipos";

const HOJE = "2026-11-10";
const f = (o: Partial<FatosDoEvento> = {}): FatosDoEvento => ({ carros: 2, comTransporteIda: 0, comTransporteVolta: 0, comChecklistSaida: 0, comChecklistRetorno: 0, ...o });
const ev = (status: StatusEvento, o: Partial<Evento> = {}) => ({ status, envio_previsto: null, retirada_prevista: null, ...o });

describe("automação do status do evento", () => {
  it("dias até a data", () => { expect(diasAte("2026-11-17", HOJE)).toBe(7); expect(diasAte("2026-11-09", HOJE)).toBe(-1); expect(diasAte(null, HOJE)).toBeNull(); });
  it("Recebido e Planejado ficam como estão sem nada acontecendo", () => {
    expect(statusAutomatico(ev("recebido"), f(), HOJE)).toBe("recebido");
    expect(statusAutomatico(ev("planejado", { envio_previsto: "2026-12-30" }), f(), HOJE)).toBe("planejado");
  });
  it("Solicitar transporte: faltam 7 dias ou menos para o envio", () => {
    expect(statusAutomatico(ev("planejado", { envio_previsto: "2026-11-17" }), f(), HOJE)).toBe("solicitar_transporte");
    expect(statusAutomatico(ev("planejado", { envio_previsto: "2026-11-18" }), f(), HOJE)).toBe("planejado");
  });
  it("Envio agendado: todos os carros com transporte de ida (não basta um)", () => {
    expect(statusAutomatico(ev("solicitar_transporte"), f({ comTransporteIda: 1 }), HOJE)).toBe("solicitar_transporte");
    expect(statusAutomatico(ev("solicitar_transporte"), f({ comTransporteIda: 2 }), HOJE)).toBe("envio_agendado");
  });
  it("Em uso: todos com checklist de saída", () => {
    expect(statusAutomatico(ev("envio_agendado"), f({ comChecklistSaida: 1 }), HOJE)).toBe("envio_agendado");
    expect(statusAutomatico(ev("envio_agendado"), f({ comChecklistSaida: 2 }), HOJE)).toBe("em_uso");
  });
  it("Solicitar retorno e Retorno solicitado só valem com o evento em uso", () => {
    const e = { retirada_prevista: "2026-11-15" };
    expect(statusAutomatico(ev("envio_agendado", e), f(), HOJE)).toBe("envio_agendado");
    expect(statusAutomatico(ev("em_uso", e), f(), HOJE)).toBe("solicitar_retorno");
    expect(statusAutomatico(ev("em_uso", e), f({ comTransporteVolta: 2 }), HOJE)).toBe("retorno_solicitado");
    expect(statusAutomatico(ev("em_uso", { retirada_prevista: "2026-12-30" }), f({ comTransporteVolta: 2 }), HOJE)).toBe("em_uso");
  });
  it("Concluído: todos com checklist de retorno; encadeia até o fim", () => {
    expect(statusAutomatico(ev("em_uso"), f({ comChecklistRetorno: 2 }), HOJE)).toBe("concluido");
    expect(statusAutomatico(ev("planejado", { retirada_prevista: "2026-11-15" }), f({ comTransporteIda: 2, comChecklistSaida: 2 }), HOJE)).toBe("solicitar_retorno");
  });
  it("nunca volta atrás nem mexe em concluído; sem carros ignora as regras de carros", () => {
    expect(statusAutomatico(ev("em_uso", { envio_previsto: "2026-11-12" }), f(), HOJE)).toBe("em_uso");
    expect(statusAutomatico(ev("concluido"), f(), HOJE)).toBe("concluido");
    expect(statusAutomatico(ev("planejado"), f({ carros: 0 }), HOJE)).toBe("planejado");
  });
});

describe("fatos do evento", () => {
  it("conta carros ativos, transportes e checklists; reserva concluída vale como saída e retorno", () => {
    const r = (id: string, estado: ReservaDoEvento["estado"]) => ({ id, evento_id: "e", estado }) as ReservaDoEvento;
    const m = fatosDosEventos({
      reservas: [r("a", "reservado"), r("b", "concluido"), r("c", "cancelado")],
      vinculos: [{ id: "a", transporte_ida_id: "t", transporte_volta_id: null }],
      checklists: [{ reserva_id: "a", momento: "saida" } as never],
    });
    expect(m.get("e")).toEqual({ carros: 2, comTransporteIda: 1, comTransporteVolta: 0, comChecklistSaida: 2, comChecklistRetorno: 1 });
  });
});
