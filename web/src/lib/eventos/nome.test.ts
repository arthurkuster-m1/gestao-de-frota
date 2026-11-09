import { describe, expect, it } from "vitest";
import { nomeAutomatico, nomeUnico } from "./nome";

describe("nome automático do evento", () => {
  it("data e responsável", () => expect(nomeAutomatico("2026-11-05", "Maria Souza")).toBe("EVENTO DIA 05/11 - MARIA SOUZA"));
  it("sem data e/ou sem responsável", () => { expect(nomeAutomatico(null, "joão")).toBe("EVENTO SEM DATA - JOÃO"); expect(nomeAutomatico("2026-11-05", " ")).toBe("EVENTO DIA 05/11"); expect(nomeAutomatico("", "")).toBe("EVENTO SEM DATA"); });
  it("repetido ganha número", () => { expect(nomeUnico("EVENTO DIA 05/11", ["evento dia 05/11"])).toBe("EVENTO DIA 05/11 (2)"); expect(nomeUnico("A", ["A", "A (2)"])).toBe("A (3)"); expect(nomeUnico("A", [])).toBe("A"); });
});
