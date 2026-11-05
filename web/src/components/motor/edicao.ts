import type { ValorDoCampo, TipoDeCampo } from "../../lib/motor/consulta";
import type { EdicaoDoCampo } from "./tipos";

export type ValorEditavel = string | boolean | null;
export type ResultadoDoPreparo = { ok: true; valor: ValorEditavel } | { ok: false; erro: string };

/** O valor atual de uma célula como o editor o entende (texto, data ISO, opção, boolean). */
export function valorParaEditor(tipo: TipoDeCampo, v: ValorDoCampo): ValorEditavel {
  if (tipo === "caixa") return v === true;
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

/**
 * Prepara o que a pessoa digitou/escolheu para gravar: arruma (normaliza), recusa vazio em campo obrigatório e valida.
 * Pura: é o que Tabela, Cards e Linha do tempo usam, então a regra é uma só.
 */
export function prepararEdicao(tipo: TipoDeCampo, edicao: EdicaoDoCampo, bruto: ValorEditavel): ResultadoDoPreparo {
  if (typeof bruto === "boolean") return { ok: true, valor: bruto };
  if (bruto === null) return edicao.obrigatorio ? { ok: false, erro: "Este campo é obrigatório." } : { ok: true, valor: null };
  let t = bruto.trim();
  if (tipo === "texto" && edicao.normalizar) t = edicao.normalizar(t);
  if (t === "") return edicao.obrigatorio ? { ok: false, erro: "Este campo é obrigatório." } : { ok: true, valor: null };
  if (tipo === "numero" && !Number.isFinite(Number((t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t).replace(/^R\$\s*/i, "")))) return { ok: false, erro: "Digite um número." };
  const erro = edicao.validar?.(t) ?? null;
  return erro ? { ok: false, erro } : { ok: true, valor: t };
}
