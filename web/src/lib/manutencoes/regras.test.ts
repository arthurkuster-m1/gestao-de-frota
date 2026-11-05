import { describe, expect, it } from "vitest";
import { agendaTexto, statusDeUso } from "../eventos/uso";
import type { Reserva } from "../eventos/tipos";
import { barrasDeManutencao } from "./barras";
import { eventoResponsavel, manutencoesQueBloqueiam, reajustarManutencao } from "./regras";
import type { Manutencao } from "./tipos";

const man = (p: Partial<Manutencao> = {}): Manutencao => ({ id: "m1", veiculo_id: "v1", nome: "Batida", tipo: "Sinistro", status: "solicitar_da", data_ocorrencia: null, data_da_solicitada: null, data_inicio: "2026-11-03", data_fim: null, bloqueia_uso: true, descricao: null, comentarios: null, created_at: "2026-11-03T10:00:00Z", ...p });
const res = (p: Partial<Reserva> = {}): Reserva => ({ id: "r1", evento_id: "e1", veiculo_id: "v1", reserva_inicio: "2026-11-10", reserva_fim: "2026-11-20", chegada: null, retirada: null, estado: "reservado", comentarios: null, ...p });

describe("status de uso com manutenção", () => {
  it("manutenção que bloqueia vence até o carro em uso", () => {
    expect(statusDeUso([res({ estado: "em_uso" })], [man()], "2026-11-05")).toBe("manutencao");
  });
  it("manutenção que não bloqueia não muda o status", () => {
    expect(statusDeUso([res({ estado: "em_uso" })], [man({ bloqueia_uso: false })], "2026-11-05")).toBe("em_uso");
  });
  it("manutenção pronta libera o carro", () => {
    expect(statusDeUso([], [man({ status: "pronto", data_fim: "2026-11-04" })], "2026-11-05")).toBe("disponivel");
  });
  it("manutenção que começa no futuro ainda não conta", () => {
    expect(statusDeUso([], [man({ data_inicio: "2026-11-20" })], "2026-11-05")).toBe("disponivel");
  });
  it("sem manutenções o comportamento antigo continua", () => {
    expect(statusDeUso([res()])).toBe("reservado");
  });
});

describe("agenda com manutenção", () => {
  const nome = () => "Convenção";
  it("a manutenção aparece primeiro, com fim ou desde", () => {
    expect(agendaTexto([res()], nome, "2026-11-05", [man({ data_fim: "2026-11-08" })])).toBe("EM MANUTENÇÃO - BATIDA 03/11 ATÉ 08/11 + RESERVADO - EVENTO CONVENÇÃO 10/11 ATÉ 20/11");
    expect(agendaTexto([], nome, "2026-11-05", [man()])).toBe("EM MANUTENÇÃO - BATIDA DESDE 03/11");
  });
  it("manutenção pronta sai da agenda", () => {
    expect(agendaTexto([], nome, "2026-11-05", [man({ status: "pronto", data_fim: "2026-11-04" })])).toBe("");
  });
});

describe("conflito ao reservar", () => {
  it("manutenção aberta sem fim bloqueia qualquer período depois do início", () => {
    expect(manutencoesQueBloqueiam({ inicio: "2026-12-01", fim: "2026-12-05" }, [man()])).toHaveLength(1);
    expect(manutencoesQueBloqueiam({ inicio: "2026-10-01", fim: "2026-10-05" }, [man()])).toHaveLength(0);
  });
  it("com fim, só bloqueia o que se sobrepõe; pronta ou sem bloqueio nunca bloqueia", () => {
    const m = man({ data_fim: "2026-11-08" });
    expect(manutencoesQueBloqueiam({ inicio: "2026-11-08", fim: "2026-11-09" }, [m])).toHaveLength(1);
    expect(manutencoesQueBloqueiam({ inicio: "2026-11-09", fim: "2026-11-12" }, [m])).toHaveLength(0);
    expect(manutencoesQueBloqueiam({ inicio: "2026-11-03", fim: "2026-11-05" }, [man({ status: "pronto", data_fim: "2026-11-04" }), man({ bloqueia_uso: false })])).toHaveLength(0);
  });
});

describe("evento responsável", () => {
  it("é o evento cuja reserva cobria o carro no dia do acidente", () => {
    expect(eventoResponsavel({ data_ocorrencia: "2026-11-12" }, [res()])).toBe("e1");
  });
  it("sem data, fora do período ou reserva cancelada: ninguém", () => {
    expect(eventoResponsavel({ data_ocorrencia: null }, [res()])).toBeNull();
    expect(eventoResponsavel({ data_ocorrencia: "2026-11-25" }, [res()])).toBeNull();
    expect(eventoResponsavel({ data_ocorrencia: "2026-11-12" }, [res({ estado: "cancelado" })])).toBeNull();
  });
  it("com troca de carro (duas reservas no dia), vale a que começou por último", () => {
    expect(eventoResponsavel({ data_ocorrencia: "2026-11-12" }, [res({ evento_id: "a", reserva_inicio: "2026-11-01" }), res({ id: "r2", evento_id: "b", reserva_inicio: "2026-11-11" })])).toBe("b");
  });
});

describe("arrastar a barra", () => {
  it("mover leva início e fim (e deixa em aberto o que não tinha fim)", () => {
    expect(reajustarManutencao({ data_inicio: "2026-11-03", data_fim: "2026-11-08" }, "mover", 2, "2026-11-05")).toEqual({ data_inicio: "2026-11-05", data_fim: "2026-11-10" });
    expect(reajustarManutencao({ data_inicio: "2026-11-03", data_fim: null }, "mover", 2, "2026-11-05")).toEqual({ data_inicio: "2026-11-05", data_fim: null });
  });
  it("esticar o fim de uma manutenção aberta parte do 'até hoje' que a barra mostra", () => {
    expect(reajustarManutencao({ data_inicio: "2026-11-03", data_fim: null }, "fim", 3, "2026-11-05")).toEqual({ data_inicio: "2026-11-03", data_fim: "2026-11-08" });
  });
  it("o fim nunca fica antes do início e o início nunca passa do fim", () => {
    expect(reajustarManutencao({ data_inicio: "2026-11-03", data_fim: "2026-11-08" }, "fim", -10, "2026-11-05").data_fim).toBe("2026-11-03");
    expect(reajustarManutencao({ data_inicio: "2026-11-03", data_fim: "2026-11-08" }, "inicio", 10, "2026-11-05").data_inicio).toBe("2026-11-08");
  });
});

describe("barras", () => {
  it("amarela quando bloqueia, azul quando não bloqueia, verde quando pronta; aberta vai até hoje", () => {
    const [a, b, c] = barrasDeManutencao([man(), man({ id: "m2", bloqueia_uso: false }), man({ id: "m3", status: "pronto", data_fim: "2026-11-04" })], "2026-11-05");
    expect([a!.tom, b!.tom, c!.tom]).toEqual(["warning", "info", "success"]);
    expect(a!.fim).toBe("2026-11-05");
    expect(c!.fim).toBe("2026-11-04");
  });
});
