import { describe, expect, it } from "vitest";
import { planejarCampo } from "./porCarro";
import type { Transporte, VinculoDaReserva } from "./tipos";

const t = (id: string, o: Partial<Transporte> = {}): Transporte => ({ id, evento_id: "e1", sentido: "ida", modalidade: null, distancia_km: null, dias_viagem: 0, referencia: null, transportadora: null, valor_planejado: null, comentarios: null, created_at: "", origem: null, destino: null, status_pagamento: null, valor_real: null, data_pagamento: null, departamento: null, ...o });
const v = (id: string, ida: string | null): VinculoDaReserva => ({ id, transporte_ida_id: ida, transporte_volta_id: null });
const base = { eventoId: "e1", sentido: "ida" as const, rota: { origem: "A", destino: "B" } };

describe("transporte por carro", () => {
  it("preencher km sem transporte cria um rascunho sem código e liga o carro", () => {
    const ops = planejarCampo({ ...base, transportes: [], vinculos: [v("r1", null)], reservaId: "r1", campo: "distancia_km", valor: 300 });
    expect(ops).toEqual([{ tipo: "criar", reservaIds: ["r1"], novo: expect.objectContaining({ referencia: null, modalidade: null, distancia_km: 300, origem: "A", destino: "B" }) }]);
  });
  it("TSO preenche a transportadora com TSO", () => {
    expect(planejarCampo({ ...base, transportes: [t("t1")], vinculos: [v("r1", "t1")], reservaId: "r1", campo: "modalidade", valor: "tso" })).toEqual([{ tipo: "atualizar", id: "t1", patch: { modalidade: "tso", transportadora: "TSO" } }]);
  });
  it("o mesmo código junta os carros num transporte só (e apaga o rascunho)", () => {
    const ops = planejarCampo({ ...base, transportes: [t("t1", { referencia: "PTAS1" }), t("t2")], vinculos: [v("r1", "t1"), v("r2", "t2")], reservaId: "r2", campo: "referencia", valor: " ptas1 " });
    expect(ops).toEqual([{ tipo: "vincular", reservaIds: ["r2"], sentido: "ida", transporteId: "t1" }, { tipo: "excluir", id: "t2" }]);
  });
  it("código novo num rascunho só renomeia; num transporte de vários carros separa o carro", () => {
    expect(planejarCampo({ ...base, transportes: [t("t2")], vinculos: [v("r2", "t2")], reservaId: "r2", campo: "referencia", valor: "PTAS9" })).toEqual([{ tipo: "atualizar", id: "t2", patch: { referencia: "PTAS9" } }]);
    const ops = planejarCampo({ ...base, transportes: [t("t1", { referencia: "PTAS1", distancia_km: 100 })], vinculos: [v("r1", "t1"), v("r2", "t1")], reservaId: "r2", campo: "referencia", valor: "PTAS9" });
    expect(ops).toEqual([{ tipo: "criar", reservaIds: ["r2"], novo: expect.objectContaining({ referencia: "PTAS9", distancia_km: 100 }) }]);
  });
  it("limpar o código: sozinho vira rascunho; em grupo, o carro sai do transporte", () => {
    expect(planejarCampo({ ...base, transportes: [t("t1", { referencia: "X" })], vinculos: [v("r1", "t1")], reservaId: "r1", campo: "referencia", valor: "" })).toEqual([{ tipo: "atualizar", id: "t1", patch: { referencia: null } }]);
    expect(planejarCampo({ ...base, transportes: [t("t1", { referencia: "X" })], vinculos: [v("r1", "t1"), v("r2", "t1")], reservaId: "r1", campo: "referencia", valor: null })).toEqual([{ tipo: "vincular", reservaIds: ["r1"], sentido: "ida", transporteId: null }]);
  });
});
