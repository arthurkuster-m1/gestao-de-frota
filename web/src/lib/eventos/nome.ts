/** Nome de um evento cadastrado às pressas: "EVENTO DIA 05/11 - FULANO" (sem data: "EVENTO SEM DATA"; sem responsável, só a data). */
export function nomeAutomatico(chegada: string | null | undefined, responsavel: string | null | undefined): string {
  const dia = chegada && /^\d{4}-\d{2}-\d{2}/.test(chegada) ? `DIA ${chegada.slice(8, 10)}/${chegada.slice(5, 7)}` : "SEM DATA";
  const quem = (responsavel ?? "").trim().toUpperCase();
  return `EVENTO ${dia}${quem ? ` - ${quem}` : ""}`;
}
/** O nome é único por espaço (sem diferenciar maiúsculas): se já existe, acrescenta (2), (3)… */
export function nomeUnico(base: string, existentes: readonly string[]): string {
  const usados = new Set(existentes.map((n) => n.trim().toLowerCase()));
  if (!usados.has(base.trim().toLowerCase())) return base;
  for (let i = 2; ; i++) { const n = `${base} (${i})`; if (!usados.has(n.toLowerCase())) return n; }
}
