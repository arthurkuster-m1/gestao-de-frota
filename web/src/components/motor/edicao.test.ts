import { describe, expect, it } from "vitest";
import { prepararEdicao, valorParaEditor } from "./edicao";

const placa = { coluna: "placa", normalizar: (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, ""), validar: (t: string) => (/^[A-Z0-9]{7}$/.test(t) ? null : "A placa tem 7 caracteres.") };
describe("prepararEdicao", () => {
  it("normaliza antes de validar (placa minúscula com hífen)", () => { expect(prepararEdicao("texto", placa, "abc-1d23")).toEqual({ ok: true, valor: "ABC1D23" }); });
  it("recusa valor inválido com a mensagem do campo", () => { expect(prepararEdicao("texto", placa, "ab")).toEqual({ ok: false, erro: "A placa tem 7 caracteres." }); });
  it("vazio vira null (limpar o campo) quando não é obrigatório", () => { expect(prepararEdicao("texto", placa, "   ")).toEqual({ ok: true, valor: null }); expect(prepararEdicao("data", { coluna: "d" }, null)).toEqual({ ok: true, valor: null }); });
  it("vazio em campo obrigatório é recusado", () => { expect(prepararEdicao("texto", { coluna: "modelo", obrigatorio: true }, "  ")).toEqual({ ok: false, erro: "Este campo é obrigatório." }); expect(prepararEdicao("opcao", { coluna: "c", obrigatorio: true }, null).ok).toBe(false); });
  it("caixa passa direto; número confere", () => { expect(prepararEdicao("caixa", { coluna: "b" }, true)).toEqual({ ok: true, valor: true }); expect(prepararEdicao("numero", { coluna: "n" }, "abc").ok).toBe(false); expect(prepararEdicao("numero", { coluna: "n" }, "12,5").ok).toBe(true); });
  it("valor atual para o editor: vazio → null, caixa → boolean", () => { expect(valorParaEditor("texto", "")).toBeNull(); expect(valorParaEditor("caixa", true)).toBe(true); expect(valorParaEditor("caixa", null)).toBe(false); expect(valorParaEditor("data", "2026-01-02")).toBe("2026-01-02"); });
});
