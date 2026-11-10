import { LANCAMENTOS_DE_EVENTOS } from "./ops/eventos";
import { LANCAMENTOS_DE_MANUTENCOES } from "./ops/manutencoes";
import { LANCAMENTOS_DE_TRANSPORTES } from "./ops/transportes";
import { LANCAMENTOS_DE_VEICULOS } from "./ops/veiculos";
import type { Lancamento } from "./tipos";

/** Todos os lançamentos do app, na ordem em que aparecem. Para ter uma nova ação em massa, é só declarar mais um aqui. */
export const LANCAMENTOS: Lancamento[] = [...LANCAMENTOS_DE_VEICULOS, ...LANCAMENTOS_DE_EVENTOS, ...LANCAMENTOS_DE_TRANSPORTES, ...LANCAMENTOS_DE_MANUTENCOES];
export const GRUPOS = ["Veículos", "Eventos", "Transportes", "Manutenções"] as const;
export const lancamentoDe = (id: string | null | undefined) => LANCAMENTOS.find((l) => l.id === id) ?? null;
