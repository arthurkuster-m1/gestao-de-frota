import { describe, expect, it } from "vitest";
import { diaDe, estadoAposChecklist, horaDe, kmTexto, paraInstante, quandoFoi } from "./regras";

describe("estado da reserva depois do checklist", () => {
  it("envio: Reservado → Em uso; o resto fica", () => {
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

import { reservasParaChecklist } from "./regras";
describe("checklist: qual evento do carro", () => {
  const r = (id: string, estado: "reservado" | "em_uso" | "cancelado" | "concluido", i: string | null, f: string | null) => ({ id, estado, reserva_inicio: i, reserva_fim: f });
  const rs = [r("futuro", "reservado", "2026-12-01", "2026-12-05"), r("hoje", "reservado", "2026-11-10", "2026-11-14"), r("passado", "reservado", "2026-10-01", "2026-10-05"), r("semdata", "reservado", null, null), r("cancel", "cancelado", "2026-11-10", "2026-11-14"), r("emuso", "em_uso", "2026-11-01", "2026-11-20")];
  it("envio: o que cobre hoje e começa mais perto, depois o que vem; sem data por último; cancelada fora", () => {
    expect(reservasParaChecklist(rs, [], "saida", "2026-11-12").map((x) => x.id)).toEqual(["hoje", "emuso", "futuro", "passado", "semdata"]);
  });
  it("retorno: o que está em uso primeiro; quem já tem o checklist do momento sai", () => {
    expect(reservasParaChecklist(rs, [{ reserva_id: "emuso", momento: "retorno" }], "retorno", "2026-11-12").map((x) => x.id)[0]).toBe("hoje");
    expect(reservasParaChecklist(rs, [], "retorno", "2026-11-12").map((x) => x.id)[0]).toBe("emuso");
    expect(reservasParaChecklist(rs, [{ reserva_id: "hoje", momento: "saida" }], "saida", "2026-11-12").map((x) => x.id)).not.toContain("hoje");
  });
});
