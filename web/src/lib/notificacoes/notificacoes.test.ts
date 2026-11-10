import { describe, expect, it } from "vitest";
import { NOTIFICACOES_PADRAO, URL_DO_PONTO, disparosDevidos, horarioValido } from "./notificacoes";

const ponto = NOTIFICACOES_PADRAO[0]!;
const quando = (iso: string) => new Date(iso);   // sem fuso = horário local, como o app usa
const nunca = () => false;

describe("notificação Bater o ponto", () => {
  it("o padrão: 07:00 e 19:20, de segunda a sexta, com o link do ponto", () => {
    expect(ponto.horarios).toEqual(["07:00", "19:20"]);
    expect(ponto.dias).toEqual([1, 2, 3, 4, 5]);
    expect(ponto.url).toBe(URL_DO_PONTO);
  });
  it("dispara no horário (segunda 07:00) e logo depois, mas não antes", () => {
    expect(disparosDevidos([ponto], quando("2026-11-09T06:59:00"), nunca)).toHaveLength(0);
    expect(disparosDevidos([ponto], quando("2026-11-09T07:00:10"), nunca).map((d) => d.horario)).toEqual(["07:00"]);
    expect(disparosDevidos([ponto], quando("2026-11-09T07:12:00"), nunca)).toHaveLength(1);
  });
  it("abrir o app ao meio-dia não dispara o aviso das 7; às 19:20 dispara o da noite", () => {
    expect(disparosDevidos([ponto], quando("2026-11-09T12:00:00"), nunca)).toHaveLength(0);
    expect(disparosDevidos([ponto], quando("2026-11-09T19:21:00"), nunca).map((d) => d.horario)).toEqual(["19:20"]);
  });
  it("não repete o mesmo horário no mesmo dia, respeita dias da semana e o interruptor", () => {
    const d = disparosDevidos([ponto], quando("2026-11-09T07:01:00"), nunca)[0]!;
    expect(disparosDevidos([ponto], quando("2026-11-09T07:02:00"), (c) => c === d.chave)).toHaveLength(0);
    expect(disparosDevidos([ponto], quando("2026-11-14T07:01:00"), nunca)).toHaveLength(0);   // sábado
    expect(disparosDevidos([{ ...ponto, ativa: false }], quando("2026-11-09T07:01:00"), nunca)).toHaveLength(0);
  });
  it("valida horários", () => { expect(horarioValido("07:00")).toBe(true); expect(horarioValido("24:00")).toBe(false); expect(horarioValido("7:00")).toBe(false); });
});
