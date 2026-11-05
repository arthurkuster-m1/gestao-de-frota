import { describe, expect, it } from "vitest";
import { aplicarArrasto, diferencas, reajustarReserva } from "./arrasto";
import { diaNaPosicao, larguraDoPeriodo, mesesDoEixo, nomeDoMes, posicaoDoDia } from "./eixo";
import { empilhar, totalDeFaixas } from "./faixas";
import { segmentosDaReserva } from "./segmentos";

describe("eixo", () => {
  it("posição e largura em px (dias inclusivos)", () => {
    expect(posicaoDoDia("2026-11-05", "2026-11-01", 44)).toBe(176);
    expect(larguraDoPeriodo("2026-11-07", "2026-11-12", 44)).toBe(6 * 44);
    expect(larguraDoPeriodo("2026-11-07", "2026-11-07", 44)).toBe(44);
  });
  it("o dia sob uma posição e a volta", () => { expect(diaNaPosicao(176, "2026-11-01", 44)).toBe("2026-11-05"); expect(diaNaPosicao(175, "2026-11-01", 44)).toBe("2026-11-04"); });
  it("meses do eixo com os dias de cada um", () => {
    expect(mesesDoEixo("2026-11-28", 8)).toEqual([{ chave: "2026-11", dias: 3 }, { chave: "2026-12", dias: 5 }]);
    expect(nomeDoMes("2026-11")).toBe("novembro 2026");
  });
});

describe("empilhar", () => {
  const b = (id: string, inicio: string, fim: string) => ({ id, inicio, fim });
  it("barras que não se sobrepõem ficam na mesma faixa", () => {
    const r = empilhar([b("a", "2026-11-01", "2026-11-03"), b("b", "2026-11-04", "2026-11-06")]);
    expect(r.map((x) => x.faixa)).toEqual([0, 0]); expect(totalDeFaixas(r)).toBe(1);
  });
  it("sobreposição (inclusive no mesmo dia) vai para outra faixa", () => {
    const r = empilhar([b("a", "2026-11-01", "2026-11-05"), b("b", "2026-11-05", "2026-11-08"), b("c", "2026-11-06", "2026-11-07")]);
    expect(r.find((x) => x.barra.id === "a")!.faixa).toBe(0); expect(r.find((x) => x.barra.id === "b")!.faixa).toBe(1); expect(r.find((x) => x.barra.id === "c")!.faixa).toBe(0);
    expect(totalDeFaixas(r)).toBe(2);
  });
});

describe("arrasto", () => {
  const p = { inicio: "2026-11-10", fim: "2026-11-14" };
  it("mover anda o bloco; esticar muda uma ponta", () => {
    expect(aplicarArrasto(p, "mover", 3)).toEqual({ inicio: "2026-11-13", fim: "2026-11-17" });
    expect(aplicarArrasto(p, "fim", 2)).toEqual({ inicio: "2026-11-10", fim: "2026-11-16" });
    expect(aplicarArrasto(p, "inicio", -2)).toEqual({ inicio: "2026-11-08", fim: "2026-11-14" });
  });
  it("nunca fica com menos de 1 dia", () => {
    expect(aplicarArrasto(p, "fim", -20)).toEqual({ inicio: "2026-11-10", fim: "2026-11-10" });
    expect(aplicarArrasto(p, "inicio", 20)).toEqual({ inicio: "2026-11-14", fim: "2026-11-14" });
  });
  const r = { reserva_inicio: "2026-11-10", reserva_fim: "2026-11-20", chegada: "2026-11-12", retirada: "2026-11-18" };
  it("mover a reserva leva chegada e retirada junto", () => {
    expect(reajustarReserva(r, "mover", 2)).toEqual({ reserva_inicio: "2026-11-12", reserva_fim: "2026-11-22", chegada: "2026-11-14", retirada: "2026-11-20" });
  });
  it("encurtar a reserva prende a chegada e a retirada dentro da janela (o banco exige)", () => {
    const novo = reajustarReserva(r, "inicio", 5);   // início vai para 15/11, depois da chegada (12/11)
    expect(novo.reserva_inicio).toBe("2026-11-15"); expect(novo.chegada).toBe("2026-11-15"); expect(novo.retirada).toBe("2026-11-18");
    const curto = reajustarReserva(r, "fim", -4);    // fim 16/11, antes da retirada (18/11)
    expect(curto.reserva_fim).toBe("2026-11-16"); expect(curto.retirada).toBe("2026-11-16"); expect(curto.chegada).toBe("2026-11-12");
  });
  it("sem chegada/retirada, só a janela muda", () => { expect(reajustarReserva({ ...r, chegada: null, retirada: null }, "fim", 2)).toEqual({ reserva_inicio: "2026-11-10", reserva_fim: "2026-11-22", chegada: null, retirada: null }); });
  it("diferenças: só o que mudou", () => { expect(diferencas(r, reajustarReserva(r, "fim", 2))).toEqual({ reserva_fim: "2026-11-22" }); });
});

describe("segmentosDaReserva", () => {
  it("logística + evento + logística, como no desenho", () => {
    const s = segmentosDaReserva({ reserva_inicio: "2026-11-10", reserva_fim: "2026-11-20", chegada: "2026-11-12", retirada: "2026-11-18" }, "neutral");
    expect(s.map((x) => [x.tipo, x.inicio, x.fim])).toEqual([["logistica", "2026-11-10", "2026-11-11"], ["principal", "2026-11-12", "2026-11-18"], ["logistica", "2026-11-19", "2026-11-20"]]);
  });
  it("sem logística (chegada no primeiro dia, retirada no último) é só o evento", () => {
    expect(segmentosDaReserva({ reserva_inicio: "2026-11-10", reserva_fim: "2026-11-12", chegada: "2026-11-10", retirada: "2026-11-12" }, "neutral").map((x) => x.tipo)).toEqual(["principal"]);
  });
  it("sem chegada e retirada, um bloco só", () => { expect(segmentosDaReserva({ reserva_inicio: "2026-11-10", reserva_fim: "2026-11-12", chegada: null, retirada: null }, "accent")).toEqual([{ inicio: "2026-11-10", fim: "2026-11-12", tom: "accent", tipo: "principal" }]); });
});
