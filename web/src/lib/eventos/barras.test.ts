import { describe, expect, it } from "vitest";
import { barraDoEvento, barrasDoVeiculo, diasDeLogistica, periodoDaReserva } from "./barras";
import type { Reserva } from "./tipos";

const R = (id: string, ev: string, ini: string, fim: string, estado: Reserva["estado"], chegada: string | null = null, retirada: string | null = null): Reserva => ({ id, evento_id: ev, veiculo_id: "v1", reserva_inicio: ini, reserva_fim: fim, chegada, retirada, estado, comentarios: null });
const nome = (id: string) => ({ e1: "Tesouraria", e2: "Feira" }[id] ?? "?");

describe("barrasDoVeiculo", () => {
  it("uma barra por reserva, sem as canceladas, com a cor do estado e o nome do evento", () => {
    const b = barrasDoVeiculo([R("a", "e1", "2026-11-04", "2026-11-05", "em_uso"), R("b", "e2", "2026-11-07", "2026-11-12", "reservado"), R("c", "e2", "2026-12-01", "2026-12-02", "cancelado")], nome);
    expect(b.map((x) => [x.rotulo, x.tom])).toEqual([["Tesouraria", "accent"], ["Feira", "neutral"]]);
  });
  it("reserva concluída não se arrasta; as outras sim; destaca o evento escolhido", () => {
    const b = barrasDoVeiculo([R("a", "e1", "2026-10-01", "2026-10-02", "concluido"), R("b", "e2", "2026-11-07", "2026-11-12", "reservado")], nome, "e2");
    expect(b[0]!.movel).toBe(false); expect(b[1]!.movel).toBe(true); expect(b[1]!.esticavel).toBe(true); expect(b[1]!.destaque).toBe(true); expect(b[0]!.destaque).toBe(false);
  });
  it("quando há chegada e retirada, a barra traz logística + evento + logística", () => {
    const b = barrasDoVeiculo([R("a", "e1", "2026-11-10", "2026-11-20", "reservado", "2026-11-12", "2026-11-18")], nome);
    expect(b[0]!.segmentos!.map((s) => s.tipo)).toEqual(["logistica", "principal", "logistica"]);
  });
});

describe("barraDoEvento", () => {
  it("vai do primeiro dia ao último de todas as reservas, com a contagem de carros", () => {
    const b = barraDoEvento({ id: "e1", nome: "Feira" }, [R("a", "e1", "2026-11-07", "2026-11-12", "reservado"), R("b", "e1", "2026-11-05", "2026-11-10", "reservado"), R("c", "e1", "2026-11-01", "2026-11-30", "cancelado")]);
    expect(b).toHaveLength(1); expect(b[0]).toMatchObject({ inicio: "2026-11-05", fim: "2026-11-12", rotulo: "Feira · 2 carros", movel: true, esticavel: false });
  });
  it("sem carros não há barra", () => { expect(barraDoEvento({ id: "e1", nome: "X" }, [])).toEqual([]); expect(barraDoEvento({ id: "e1", nome: "X" }, [R("a", "e1", "2026-11-01", "2026-11-02", "cancelado")])).toEqual([]); });
  it("a logística aparece antes da 1ª chegada e depois da última retirada", () => {
    const b = barraDoEvento({ id: "e1", nome: "Feira" }, [R("a", "e1", "2026-11-05", "2026-11-14", "reservado", "2026-11-07", "2026-11-12"), R("b", "e1", "2026-11-06", "2026-11-15", "reservado", "2026-11-08", "2026-11-13")]);
    expect(b[0]!.segmentos!.map((s) => [s.tipo, s.inicio, s.fim])).toEqual([["logistica", "2026-11-05", "2026-11-06"], ["principal", "2026-11-07", "2026-11-13"], ["logistica", "2026-11-14", "2026-11-15"]]);
    expect(b[0]!.rotulo).toBe("Feira · 2 carros");
  });
});

describe("logística", () => {
  it("período da reserva = chegada − dias de ida … retirada + dias de volta", () => { expect(periodoDaReserva("2026-11-12", "2026-11-18", 2, 1)).toEqual({ inicio: "2026-11-10", fim: "2026-11-19" }); expect(periodoDaReserva("2026-11-12", "2026-11-18", 0, 0)).toEqual({ inicio: "2026-11-12", fim: "2026-11-18" }); });
  it("quantos dias de ida e de volta uma reserva tem", () => { expect(diasDeLogistica("2026-11-10", "2026-11-12", "2026-11-18", "2026-11-19")).toEqual({ ida: 2, volta: 1 }); expect(diasDeLogistica("2026-11-10", null, null, "2026-11-19")).toEqual({ ida: 0, volta: 0 }); });
});
