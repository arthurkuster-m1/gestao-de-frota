import type { Operador, TipoDeCampo } from "../../lib/motor/consulta";

export const ROTULO_DO_OPERADOR: Record<Operador, string> = {
  contem: "contém", nao_contem: "não contém", e: "é", nao_e: "não é", vazio: "está vazio", preenchido: "está preenchido",
  antes: "antes de", ate: "até", depois: "depois de", a_partir: "a partir de", periodo: "está em",
  igual: "igual a", maior: "maior que", menor: "menor que", marcado: "está marcado", desmarcado: "está desmarcado",
};
/** O operador "é" lê melhor como "contém" quando o campo é de vários valores, e "é qualquer um de" nas opções. */
export const rotuloDoOperador = (op: Operador, tipo: TipoDeCampo) => (tipo === "opcao" && op === "e" ? "é" : ROTULO_DO_OPERADOR[op]);

export const ROTULO_DA_DATA: Record<string, string> = {
  hoje: "Hoje", ontem: "Ontem", amanha: "Amanhã", depois_de_amanha: "Depois de amanhã", inicio_da_semana: "Início da semana",
  fim_da_semana: "Fim da semana", inicio_do_mes: "Início do mês", fim_do_mes: "Fim do mês",
};
export const ROTULO_DO_PERIODO: Record<string, string> = {
  hoje: "Hoje", ontem: "Ontem", amanha: "Amanhã", esta_semana: "Esta semana", semana_passada: "Semana passada", proxima_semana: "Próxima semana",
  este_mes: "Este mês", mes_passado: "Mês passado", proximo_mes: "Próximo mês", ultimos_7_dias: "Últimos 7 dias", proximos_5_dias: "Próximos 5 dias",
  proximos_7_dias: "Próximos 7 dias", ultimos_30_dias: "Últimos 30 dias", proximos_30_dias: "Próximos 30 dias",
};
