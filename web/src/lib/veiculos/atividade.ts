import { CICLO } from "./tipos";

/** A descrição que o banco grava ("Ciclo de vida: liberado → em_transporte_0km") com os nomes que a pessoa lê. */
export const textoAtividade = (t: string) => CICLO.reduce((s, c) => s.split(c.value).join(c.label), t);
export const quando = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
