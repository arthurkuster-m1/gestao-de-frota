import { describe, expect, it } from "vitest";
import { diaCurto } from "./ProximosDoInicio";

describe("dia da semana curtinho nos próximos envios e retornos", () => {
  it("sem o '-feira'", () => {
    expect(diaCurto("2026-11-16")).toBe("segunda");
    expect(diaCurto("2026-11-17")).toBe("terça");
    expect(diaCurto("2026-11-18")).toBe("quarta");
    expect(diaCurto("2026-11-19")).toBe("quinta");
    expect(diaCurto("2026-11-20")).toBe("sexta");
    expect(diaCurto("2026-11-21")).toBe("sábado");
    expect(diaCurto("2026-11-22")).toBe("domingo");
  });
});
