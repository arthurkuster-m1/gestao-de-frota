import { describe, expect, it } from "vitest";
import { aplicarConsulta } from "../motor/consulta";
import { configSegura } from "../motor/visoes";
import type { Evento } from "./tipos";
import { VISOES_FIXAS_DE_EVENTOS } from "./visoesFixas";

const campos = [
  { id: "envio", titulo: "Data de envio", tipo: "data" as const, valorDe: (e: Evento) => e.envio_previsto ?? null, largura: 100 },
  { id: "fim", titulo: "Data de retirada", tipo: "data" as const, valorDe: (e: Evento) => e.retirada_prevista, largura: 100 },
];
const ev = (id: string, o: Partial<Evento>) => ({ id, ...o }) as Evento;
const HOJE = "2026-11-10";

describe("visualizações de fábrica de Eventos", () => {
  it("são aceitas pelo esquema de preferências", () => {
    for (const v of VISOES_FIXAS_DE_EVENTOS) expect(configSegura(v.prefs as never)).toMatchObject({ filtros: v.prefs.filtros });
  });
  it("Próximos envios: só a data de envio dos próximos 30 dias, do mais próximo ao mais distante", () => {
    const l = [ev("longe", { envio_previsto: "2027-01-10" }), ev("b", { envio_previsto: "2026-11-20" }), ev("a", { envio_previsto: "2026-11-10" }), ev("passou", { envio_previsto: "2026-11-09" }), ev("sem", {})];
    const r = aplicarConsulta(l, campos as never, VISOES_FIXAS_DE_EVENTOS[0]!.prefs, { hoje: HOJE });
    expect(r.linhas.map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("Próximos retornos: a data de retirada dos próximos 30 dias", () => {
    const l = [ev("x", { retirada_prevista: "2026-12-09" }), ev("y", { retirada_prevista: "2026-12-10" }), ev("z", { retirada_prevista: "2026-11-12" })];
    const r = aplicarConsulta(l, campos as never, VISOES_FIXAS_DE_EVENTOS[1]!.prefs, { hoje: HOJE });
    expect(r.linhas.map((x) => x.id)).toEqual(["z", "x"]);
  });
});
