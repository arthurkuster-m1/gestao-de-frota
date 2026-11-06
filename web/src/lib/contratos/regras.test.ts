import { describe, expect, it } from "vitest";
import type { Reserva } from "../eventos/tipos";
import { carrosEmVigor, divergencias, vigenciaEmVigor, vigenciaSugerida } from "./regras";
import type { Aditivo, AditivoVeiculo } from "./tipos";

const ad = (p: Partial<Aditivo>): Aditivo => ({ id: "a1", contrato_id: "k", tipo: "extensao_prazo", status: "assinado", motivo: null, vigencia_fim_anterior: null, vigencia_fim_nova: null, assinado_em: "2026-11-12", created_at: "2026-11-12T10:00:00Z", ...p });
const item = (aditivo_id: string, veiculo_id: string, acao: "sai" | "entra"): AditivoVeiculo => ({ id: aditivo_id + veiculo_id, aditivo_id, veiculo_id, acao });
const res = (p: Partial<Reserva>): Reserva => ({ id: "r", evento_id: "e", veiculo_id: "v1", reserva_inicio: "2026-11-08", reserva_fim: "2026-11-22", chegada: "2026-11-10", retirada: "2026-11-20", estado: "reservado", comentarios: null, ...p });
const nome = (id: string) => id.toUpperCase();

describe("vigência em vigor", () => {
  const c = { vigencia_inicio: "2026-11-10", vigencia_fim: "2026-11-20" };
  it("sem aditivo vale a do contrato; extensão só conta depois de assinada; vale a última assinada", () => {
    expect(vigenciaEmVigor(c, []).fim).toBe("2026-11-20");
    expect(vigenciaEmVigor(c, [ad({ status: "enviado", vigencia_fim_nova: "2026-12-01" })]).fim).toBe("2026-11-20");
    expect(vigenciaEmVigor(c, [ad({ vigencia_fim_nova: "2026-12-01" }), ad({ id: "a2", assinado_em: "2026-11-15", created_at: "2026-11-15T10:00:00Z", vigencia_fim_nova: "2026-12-20" })]).fim).toBe("2026-12-20");
  });
});
describe("carros em vigor", () => {
  it("troca assinada tira e põe; troca não assinada não conta", () => {
    const base = [{ veiculo_id: "v1" }, { veiculo_id: "v2" }];
    const t = ad({ id: "t1", tipo: "troca_carros" });
    expect([...carrosEmVigor(base, [t], [item("t1", "v1", "sai"), item("t1", "v3", "entra")])].sort()).toEqual(["v2", "v3"]);
    expect([...carrosEmVigor(base, [{ ...t, status: "rascunho" }], [item("t1", "v1", "sai"), item("t1", "v3", "entra")])].sort()).toEqual(["v1", "v2"]);
  });
});
describe("divergências", () => {
  const vig = { inicio: "2026-11-10", fim: "2026-11-20" };
  it("tudo certo: nenhuma", () => { expect(divergencias(new Set(["v1"]), vig, [res({})], nome)).toEqual([]); });
  it("carro reservado fora do contrato e carro do contrato sem reserva", () => {
    const d = divergencias(new Set(["v2"]), vig, [res({})], nome);
    expect(d.map((x) => x.tipo).sort()).toEqual(["carro_sem_contrato", "carro_sem_reserva"]);
  });
  it("reserva que passa do fim da vigência; cancelada não conta", () => {
    expect(divergencias(new Set(["v1"]), vig, [res({ retirada: "2026-11-25" })], nome)[0]!.tipo).toBe("fora_da_vigencia");
    expect(divergencias(new Set(), vig, [res({ estado: "cancelado" })], nome)).toEqual([]);
  });
  it("sem chegada e retirada usa o período da reserva", () => {
    expect(divergencias(new Set(["v1"]), vig, [res({ chegada: null, retirada: null })], nome).map((x) => x.tipo)).toEqual(["fora_da_vigencia"]);
  });
});
describe("vigência sugerida", () => {
  it("da primeira chegada à última retirada", () => {
    expect(vigenciaSugerida([res({}), res({ id: "r2", veiculo_id: "v2", chegada: "2026-11-09", retirada: "2026-11-24" })])).toEqual({ inicio: "2026-11-09", fim: "2026-11-24" });
    expect(vigenciaSugerida([])).toEqual({ inicio: null, fim: null });
  });
});
