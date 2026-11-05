import { normalizarConsulta } from "./consulta";
import type { PreferenciasDaTabela } from "./layout";

const limpar = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(limpar);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) { const x = limpar((v as Record<string, unknown>)[k]); if (x !== undefined && !(Array.isArray(x) && x.length === 0) && !(x && typeof x === "object" && !Array.isArray(x) && Object.keys(x).length === 0)) o[k] = x; }
    return o;
  }
  return v;
};
/** Forma comparável: sem chaves vazias, de chaves em ordem — "mudou algo?" não pode depender de undefined ou de lista vazia. */
export const chaveDasPrefs = (p: PreferenciasDaTabela | undefined): string => JSON.stringify(limpar({ ...p, ...normalizarConsulta(p), ...(p?.filtros?.length ? {} : { filtros: undefined }) }));
export const prefsIguais = (a: PreferenciasDaTabela | undefined, b: PreferenciasDaTabela | undefined) => chaveDasPrefs(a) === chaveDasPrefs(b);
