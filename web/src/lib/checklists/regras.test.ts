import { describe, expect, it } from "vitest";
import { diaDe, estadoAposChecklist, horaDe, kmTexto, paraInstante, quandoFoi } from "./regras";

describe("estado da reserva depois do checklist", () => {
  it("saída: Reservado → Em uso; o resto fica", () => {
    expect(estadoAposChecklist("reservado", "saida")).toBe("em_uso");
    expect(estadoAposChecklist("em_uso", "saida")).toBe("em_uso");
    expect(estadoAposChecklist("cancelado", "saida")).toBe("cancelado");
    expect(estadoAposChecklist("concluido", "saida")).toBe("concluido");
  });
  it("retorno: conclui (menos cancelada)", () => {
    for (const e of ["reservado", "em_uso", "em_retorno"] as const) expect(estadoAposChecklist(e, "retorno")).toBe("concluido");
    expect(estadoAposChecklist("cancelado", "retorno")).toBe("cancelado");
  });
});
describe("data e hora de São Paulo", () => {
  it("ida e volta sem escorregar de dia", () => {
    const i = paraInstante("2026-11-05", "23:30");
    expect(diaDe(i)).toBe("2026-11-05"); expect(horaDe(i)).toBe("23:30"); expect(quandoFoi(i)).toBe("05/11/2026 23:30");
    expect(paraInstante("2026-11-05", "")).toBe("2026-11-05T00:00:00-03:00");
  });
  it("km em texto", () => { expect(kmTexto(12340)).toBe("12.340 km"); expect(kmTexto(null)).toBeNull(); });
});

import { reservasSemChecklist } from "./regras";
describe("checklist em massa", () => {
  it("só as reservas ativas que ainda não têm o checklist do momento", () => {
    const rs = [{ id: "a", estado: "reservado" as const }, { id: "b", estado: "reservado" as const }, { id: "c", estado: "cancelado" as const }, { id: "d", estado: "concluido" as const }];
    expect(reservasSemChecklist(rs, [{ reserva_id: "a", momento: "saida" }], "saida")).toEqual(["b"]);
    expect(reservasSemChecklist(rs, [{ reserva_id: "a", momento: "retorno" }], "saida")).toEqual(["a", "b"]);
  });
});
