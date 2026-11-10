import { describe, expect, it } from "vitest";
import { reservavelPeloCiclo, statusDeUso, usoDoCiclo } from "./uso";

const reservada = [{ estado: "reservado" }, { estado: "em_uso" }] as never;

describe("status de uso pelo ciclo de vida", () => {
  it("pedido, liberado e em transporte 0 km: indisponível, mesmo com reservas", () => {
    for (const c of ["pedido_recebido", "liberado", "em_transporte_0km"]) { expect(statusDeUso(reservada, [], "2026-11-12", c)).toBe("indisponivel"); expect(reservavelPeloCiclo(c)).toBe(false); }
  });
  it("disponível sem faturamento e pronto: valem as reservas (disponível, reservado, em uso)", () => {
    for (const c of ["disponivel_sem_faturamento", "disponivel"]) {
      expect(statusDeUso([], [], "2026-11-12", c)).toBe("disponivel");
      expect(statusDeUso([{ estado: "reservado" }] as never, [], "2026-11-12", c)).toBe("reservado");
      expect(statusDeUso(reservada, [], "2026-11-12", c)).toBe("em_uso");
      expect(reservavelPeloCiclo(c)).toBe(true);
    }
  });
  it("em blindagem, gravame, venda VIP e devolvido: status próprio e fora das reservas", () => {
    expect(usoDoCiclo("em_blindagem")).toBe("em_blindagem"); expect(usoDoCiclo("gravame")).toBe("gravame"); expect(usoDoCiclo("venda_vip")).toBe("venda_vip"); expect(usoDoCiclo("devolvido")).toBe("devolvido");
    for (const c of ["em_blindagem", "gravame", "venda_vip", "devolvido"]) expect(reservavelPeloCiclo(c)).toBe(false);
  });
  it("em devolução: status próprio, mas ainda recebe reservas (com alerta)", () => {
    expect(statusDeUso([], [], "2026-11-12", "em_devolucao")).toBe("em_devolucao");
    expect(reservavelPeloCiclo("em_devolucao")).toBe(true);
  });
  it("sem ciclo informado, tudo como antes", () => { expect(statusDeUso(reservada, [])).toBe("em_uso"); });
});
