/** Dinheiro e datas. Dinheiro é SEMPRE inteiro em centavos (bigint no banco); datas são "AAAA-MM-DD" locais (nunca UTC). */

const pad = (n: number) => String(n).padStart(2, "0");

export function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Texto digitado → centavos. Aceita "1.234,56", "1234,56", "1234.56", "R$ 12,5". Inválido ou negativo → null. */
export function parseValor(texto: string): number | null {
  let t = texto.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!t || t.startsWith("-")) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // "1.234" = mil duzentos e trinta e quatro
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Campo estilo banco: o usuário digita só dígitos e as duas últimas casas são os centavos ("4590" → 4590). */
export function digitosParaCentavos(texto: string): number {
  const d = texto.replace(/\D/g, "").slice(0, 12);
  return d ? parseInt(d, 10) : 0;
}

/** 4590 → "45,90" (sem símbolo, para dentro do campo). 0 → "". */
export function centavosParaCampo(c: number): string {
  if (!c) return "";
  return (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

