import { describe, expect, it } from "vitest";
import { executarEmLote } from "./emLote";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
describe("gravar em lote", () => {
  it("linhas diferentes rodam juntas (no máximo `limite` ao mesmo tempo); a mesma linha, em ordem", async () => {
    let ativas = 0, pico = 0; const log: string[] = [];
    const t = (chave: string, n: string) => ({ chave, executar: async () => { ativas++; pico = Math.max(pico, ativas); await espera(15); log.push(`${chave}${n}`); ativas--; } });
    await executarEmLote([t("a", "1"), t("a", "2"), t("b", "1"), t("c", "1"), t("d", "1"), t("e", "1")], 3);
    expect(pico).toBe(3);
    expect(log.indexOf("a1")).toBeLessThan(log.indexOf("a2"));
    expect(log).toHaveLength(6);
  });
  it("sem tarefas não faz nada; um erro tratado dentro da tarefa não derruba as outras", async () => {
    await executarEmLote([]);
    const feitos: string[] = [];
    await executarEmLote([{ chave: "x", executar: async () => { try { throw new Error("falhou"); } catch { feitos.push("erro"); } } }, { chave: "y", executar: async () => { feitos.push("ok"); } }]);
    expect(feitos.sort()).toEqual(["erro", "ok"]);
  });
});
