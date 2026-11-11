/**
 * Contas de data do motor, sobre CHAVES de dia ("AAAA-MM-DD") — nunca sobre instantes, para não
 * escorregar de fuso. (No CRM isto vive em lib/inicio/datas e lib/motor/calendario; aqui só o que o motor usa.)
 */
const ms = (c: string) => { const [a, m, d] = c.split("-").map(Number); return Date.UTC(a!, m! - 1, d!); };
const chave = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; };

export const somarDias = (c: string, n: number): string => chave(ms(c) + n * 86_400_000);
/** 0 = segunda … 6 = domingo (a semana do CRM começa na segunda). */
export const diaDaSemanaDaChave = (c: string): number => (new Date(ms(c)).getUTCDay() + 6) % 7;
/** Os 7 dias da semana de `c`, de segunda a domingo. */
export const diasDaSemana = (c: string): string[] => { const seg = somarDias(c, -diaDaSemanaDaChave(c)); return Array.from({ length: 7 }, (_, i) => somarDias(seg, i)); };
export const diferencaEmDias = (a: string, b: string): number => Math.round((ms(b) - ms(a)) / 86_400_000);

/** Hoje no fuso do negócio (a frota é de São Paulo). */
export function hojeLocal(fuso = "America/Sao_Paulo"): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return p; // en-CA já formata AAAA-MM-DD
}

export const inicioDoMes = (c: string): string => `${c.slice(0, 7)}-01`;
export function somarMeses(c: string, meses: number): string {
  const [a, m] = c.split("-").map(Number); const t = a! * 12 + (m! - 1) + meses;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
}
export const inicioDaSemana = (c: string): string => somarDias(c, -diaDaSemanaDaChave(c));
export function chaveDoPeriodo(c: string, granularidade: "dia" | "semana" | "mes"): string {
  if (granularidade === "semana") return inicioDaSemana(c);
  if (granularidade === "mes") return inicioDoMes(c);
  return c;
}
/** "2026-10-09" → "09/10/2026". */
export function formatarDiaBr(c: string): string { if (c.startsWith("9999-12-31")) return "em aberto"; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(c); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; }
