import { describe, expect, it } from "vitest";
import { agendaTexto, conflitos, reservasPorVeiculo, statusDeUso } from "./uso";
import type { Reserva } from "./tipos";

const R = (id: string, evento: string, ini: string, fim: string, estado: Reserva["estado"], veiculo = "v1"): Reserva => ({ id, evento_id: evento, veiculo_id: veiculo, reserva_inicio: ini, reserva_fim: fim, chegada: null, retirada: null, estado, comentarios: null });
const nomes: Record<string, string> = { e1: "Tesouraria", e2: "Feira do Campo", e3: "Gravação Verão" };
const nome = (id: string) => nomes[id] ?? "?";
const hoje = "2026-11-05";

describe("statusDeUso", () => {
  it("sem reserva aberta o carro está Disponível (concluída e cancelada não contam)", () => {
    expect(statusDeUso([])).toBe("disponivel");
    expect(statusDeUso([R("1", "e1", "2026-10-01", "2026-10-02", "concluido"), R("2", "e2", "2026-10-05", "2026-10-06", "cancelado")])).toBe("disponivel");
  });
  it("uma reserva futura deixa Reservado", () => { expect(statusDeUso([R("1", "e1", "2026-12-01", "2026-12-02", "reservado")])).toBe("reservado"); });
  it("em uso vale mais que reservado; em retorno vale mais que em uso", () => {
    expect(statusDeUso([R("1", "e1", "2026-11-04", "2026-11-05", "em_uso"), R("2", "e2", "2026-11-07", "2026-11-12", "reservado")])).toBe("em_uso");
    expect(statusDeUso([R("1", "e1", "2026-11-04", "2026-11-05", "em_retorno"), R("2", "e2", "2026-11-07", "2026-11-12", "em_uso")])).toBe("em_retorno");
  });
});

describe("agendaTexto", () => {
  it("é vazia sem reserva aberta", () => { expect(agendaTexto([], nome, hoje)).toBe(""); expect(agendaTexto([R("1", "e1", "2026-10-01", "2026-10-02", "concluido")], nome, hoje)).toBe(""); });
  it("uma reserva no formato pedido pelo Arthur", () => {
    expect(agendaTexto([R("1", "e2", "2026-11-07", "2026-11-12", "reservado")], nome, hoje)).toBe("RESERVADO - EVENTO FEIRA DO CAMPO 07/11 ATÉ 12/11");
  });
  it("acumula: em uso primeiro, depois as reservas por data, ligadas por ' + '", () => {
    const r = [R("a", "e3", "2026-12-20", "2026-12-22", "reservado"), R("b", "e2", "2026-11-07", "2026-11-12", "reservado"), R("c", "e1", "2026-11-04", "2026-11-05", "em_uso")];
    expect(agendaTexto(r, nome, hoje)).toBe("EM USO - EVENTO TESOURARIA 04/11 ATÉ 05/11 + RESERVADO - EVENTO FEIRA DO CAMPO 07/11 ATÉ 12/11 + RESERVADO - EVENTO GRAVAÇÃO VERÃO 20/12 ATÉ 22/12");
  });
  it("mostra o ano só quando não é o ano corrente", () => {
    expect(agendaTexto([R("1", "e1", "2026-12-28", "2027-01-03", "reservado")], nome, hoje)).toBe("RESERVADO - EVENTO TESOURARIA 28/12 ATÉ 03/01/27");
  });
});

describe("conflitos", () => {
  const abertas = [R("1", "e1", "2026-11-04", "2026-11-05", "em_uso"), R("2", "e2", "2026-11-07", "2026-11-12", "reservado"), R("3", "e3", "2026-10-01", "2026-10-02", "concluido")];
  it("acha as reservas abertas que se sobrepõem (datas inclusivas)", () => {
    expect(conflitos({ inicio: "2026-11-05", fim: "2026-11-06" }, abertas).map((r) => r.id)).toEqual(["1"]);
    expect(conflitos({ inicio: "2026-11-06", fim: "2026-11-07" }, abertas).map((r) => r.id)).toEqual(["2"]);
    expect(conflitos({ inicio: "2026-11-13", fim: "2026-11-14" }, abertas)).toEqual([]);
  });
  it("ignora a concluída e o próprio evento", () => {
    expect(conflitos({ inicio: "2026-10-01", fim: "2026-10-02" }, abertas)).toEqual([]);
    expect(conflitos({ inicio: "2026-11-07", fim: "2026-11-08" }, abertas, "e2")).toEqual([]);
  });
});

describe("reservasPorVeiculo", () => { it("agrupa por carro", () => { const m = reservasPorVeiculo([R("1", "e1", "2026-11-01", "2026-11-02", "reservado", "a"), R("2", "e2", "2026-11-03", "2026-11-04", "reservado", "b"), R("3", "e3", "2026-11-05", "2026-11-06", "reservado", "a")]); expect(m.get("a")?.length).toBe(2); expect(m.get("b")?.length).toBe(1); }); });
