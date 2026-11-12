import { describe, expect, it } from "vitest";
import { datasPelasReservas, patchDeDatas } from "./sincronizarDatas";

const r = (o = {}) => ({ reserva_inicio: "2026-11-05", reserva_fim: "2026-11-20", chegada: "2026-11-08", retirada: "2026-11-15", estado: "reservado", ...o });

describe("sincronizar datas do evento e das reservas", () => {
  it("nova retirada leva a logística de volta junto (margem de 5 dias)", () => {
    expect(patchDeDatas(r(), { retirada: "2026-11-18" })).toEqual({ retirada: "2026-11-18", reserva_fim: "2026-11-23" });
  });
  it("nova chegada leva a logística de ida junto (margem de 3 dias)", () => {
    expect(patchDeDatas(r(), { chegada: "2026-11-10" })).toEqual({ chegada: "2026-11-10", reserva_inicio: "2026-11-07" });
  });
  it("sem retirada própria, o fim da reserva é a retirada", () => {
    expect(patchDeDatas(r({ retirada: null }), { retirada: "2026-11-25" })).toEqual({ retirada: "2026-11-25", reserva_fim: "2026-11-25" });
  });
  it("reserva em aberto fecha na retirada", () => {
    expect(patchDeDatas(r({ retirada: null, reserva_fim: "9999-12-31" }), { retirada: "2026-11-25" }).reserva_fim).toBe("2026-11-25");
  });
  it("retirada antes da chegada dá erro claro", () => {
    expect(() => patchDeDatas(r(), { retirada: "2026-11-07" })).toThrow(/antes da chegada/);
  });
  it("datas do evento = chegada mais cedo e retirada mais tarde dos carros", () => {
    expect(datasPelasReservas([r(), r({ chegada: "2026-11-06", retirada: "2026-11-19" }), r({ estado: "cancelado", retirada: "2027-01-01" })])).toEqual({ chegada: "2026-11-06", retirada: "2026-11-19" });
    expect(datasPelasReservas([])).toBeNull();
    expect(datasPelasReservas([r({ reserva_fim: "9999-12-31", retirada: null })])?.retirada).toBeNull();
  });
});
