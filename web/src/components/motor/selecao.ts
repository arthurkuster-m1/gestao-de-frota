import type { ValorDoCampo } from "../../lib/motor/consulta";
import { formatarDiaBr } from "../../lib/motor/datas";
import type { ValorEditavel } from "./edicao";
import type { CampoDaTela } from "./tipos";

export type Ponto = { l: number; c: number };
export type Intervalo = { l0: number; l1: number; c0: number; c1: number };

export const intervaloDe = (a: Ponto, b: Ponto): Intervalo => ({ l0: Math.min(a.l, b.l), l1: Math.max(a.l, b.l), c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c) });
export const multiplas = (i: Intervalo) => i.l0 !== i.l1 || i.c0 !== i.c1;

/** O valor de uma célula como TEXTO PURO (é o que vai para a área de transferência: Excel, Notion e outras tabelas leem isso). */
export function textoDaCelula<T>(c: CampoDaTela<T>, l: T): string {
  const v: ValorDoCampo = c.valorDe(l);
  if (v === null || v === undefined || v === "") return "";
  if (c.tipo === "caixa") return v === true ? "Sim" : "Não";
  if (c.tipo === "data") return formatarDiaBr(String(v));
  if (c.tipo === "opcao") return c.opcoes?.find((x) => x.value === v)?.label ?? String(v);
  if (Array.isArray(v)) return v.map((x) => c.rotuloDoValor?.(x) ?? x).join(", ");
  return String(v);
}

/** Texto tabulado (TSV): colunas separadas por TAB, linhas por quebra de linha. Células com TAB/quebra/aspas vão entre aspas, como o Excel faz. */
export function paraTsv(linhas: string[][]): string {
  const cel = (t: string) => (/[\t\r\n"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  return linhas.map((r) => r.map(cel).join("\t")).join("\n");
}

/** Lê o que veio do Excel/Notion/outra tabela: TSV com aspas. */
export function deTsv(texto: string): string[][] {
  const t = texto.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  const linhas: string[][] = []; let linha: string[] = [], cel = "", aspas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (aspas) { if (ch === '"') { if (t[i + 1] === '"') { cel += '"'; i++; } else aspas = false; } else cel += ch; }
    else if (ch === '"' && cel === "") aspas = true;
    else if (ch === "\t") { linha.push(cel); cel = ""; }
    else if (ch === "\n") { linha.push(cel); linhas.push(linha); linha = []; cel = ""; }
    else cel += ch;
  }
  linha.push(cel); linhas.push(linha);
  return linhas;
}

/** Transforma o texto colado no valor que a edição entende; null = não dá para colar neste campo. */
export function converterColado<T>(c: CampoDaTela<T>, texto: string): ValorEditavel | undefined {
  const t = texto.trim();
  if (c.tipo === "caixa") { const n = t.toLowerCase(); return ["sim", "true", "1", "x", "verdadeiro"].includes(n); }
  if (t === "") return null;
  if (c.tipo === "data") {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : undefined;
  }
  if (c.tipo === "opcao") {
    const n = t.toLowerCase();
    return c.opcoes?.find((o) => o.label.toLowerCase() === n || o.value.toLowerCase() === n)?.value;
  }
  if (c.tipo === "multi" || c.tipo === "pessoa") return undefined;
  return t;
}
