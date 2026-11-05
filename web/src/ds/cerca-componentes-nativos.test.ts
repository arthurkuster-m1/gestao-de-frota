import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Cerca do Design System: listas e datas do navegador (quadradas, azul do sistema, sem tema escuro) não entram no app. */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? arquivos(p) : /\.tsx$/.test(n) ? [p] : []; });
}

describe("componentes nativos proibidos fora do Design System", () => {
  const permitidos = new Set([join("src", "ds", "components", "Select.tsx")]); // guarda um <select> escondido só para ler as opções
  const fontes = arquivos("src").filter((f) => !f.endsWith(".test.tsx") && !permitidos.has(f));

  it.each([
    ["<select>", /<select[\s>]/],
    ['type="date"', /type=["']date["']/],
    ['type="month"', /type=["']month["']/],
    ['type="time"', /type=["']time["']/],
    ['type="datetime-local"', /type=["']datetime-local["']/],
  ])("nenhum %s nativo — use Select, DateField ou MonthField", (_nome, padrao) => {
    const achados = fontes.filter((f) => padrao.test(readFileSync(f, "utf8")));
    expect(achados).toEqual([]);
  });
});
