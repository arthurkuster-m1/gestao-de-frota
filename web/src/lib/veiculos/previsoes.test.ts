import { describe, expect, it } from "vitest";
import { MARCOS_PREVISTOS, disponivelAPartirDe, patchDeConfirmacao, previsoesPendentes, previsoesQueChegaram } from "./previsoes";

const v = (o = {}) => ({ status_ciclo: "pedido_recebido", ...o }) as never;
describe("previsões do ciclo de vida", () => {
  it("só conta previsão enquanto a data real não existe", () => {
    expect(previsoesPendentes(v({ data_liberacao_prevista: "2026-12-01" })).length).toBe(1);
    expect(previsoesPendentes(v({ data_liberacao_prevista: "2026-12-01", data_liberacao: "2026-11-30" })).length).toBe(0);
  });
  it("a data chegou quando é hoje ou já passou", () => {
    const c = v({ data_liberacao_prevista: "2026-11-12", data_faturamento_prevista: "2026-12-30" });
    expect(previsoesQueChegaram(c, "2026-11-12").map((p) => p.marco.id)).toEqual(["liberacao"]);
    expect(previsoesQueChegaram(c, "2026-11-11")).toEqual([]);
  });
  it("confirmar vira data real e limpa a previsão", () => {
    expect(patchDeConfirmacao(v({ data_faturamento_prevista: "2026-12-05" }), MARCOS_PREVISTOS[1])).toEqual({ data_faturamento: "2026-12-05", data_faturamento_prevista: null });
  });
  it("carro bloqueado pelo ciclo fica reservável a partir da primeira previsão", () => {
    expect(disponivelAPartirDe(v({ data_liberacao_prevista: "2026-12-01", data_emplacamento_prevista: "2026-12-20" }))).toBe("2026-12-01");
    expect(disponivelAPartirDe(v({ status_ciclo: "liberado", data_faturamento_prevista: "2026-12-10" }))).toBe("2026-12-10");
    expect(disponivelAPartirDe(v())).toBeNull();                                   // sem previsão: segue indisponível
    expect(disponivelAPartirDe(v({ status_ciclo: "disponivel", data_liberacao_prevista: "2026-12-01" }))).toBeNull();   // já é reservável
    expect(disponivelAPartirDe(v({ status_ciclo: "gravame", data_liberacao_prevista: "2026-12-01" }))).toBeNull();      // gravame não libera por previsão
  });
});
