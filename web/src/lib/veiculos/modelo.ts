/** "S10 High Country" → modelo mãe "S10" (a 1ª palavra) e versão "High Country" (o resto, pode ter várias palavras). */
export function partirModelo(modelo: string | null | undefined): { mae: string | null; versao: string | null } {
  const t = (modelo ?? "").trim().replace(/\s+/g, " ");
  if (!t) return { mae: null, versao: null };
  const i = t.indexOf(" ");
  return i < 0 ? { mae: t, versao: null } : { mae: t.slice(0, i), versao: t.slice(i + 1) };
}
