import type { PreferenciasDaTabela } from "../motor/layout";

/**
 * Visualizações de fábrica de Eventos: "Próximos envios" (Data de envio nos próximos 30 dias, do mais próximo ao mais distante) e
 * "Próximos retornos" (Data de retirada nos próximos 30 dias). Já vêm com o filtro da data e as colunas mais úteis ligadas;
 * a pessoa pode mudar e salvar.
 */
export const VISOES_FIXAS_DE_EVENTOS: { id: string; rotulo: string; prefs: PreferenciasDaTabela }[] = [
  {
    id: "proximos-envios", rotulo: "Próximos envios",
    prefs: {
      visualizacao: "tabela",
      filtros: [{ campo: "envio", operador: "periodo", valor: "proximos_30_dias" }],
      ordenacao: [{ campo: "envio", direcao: "asc" }],
      ordem: ["envio", "inicio", "status", "carros", "locais", "cliente", "distIda", "origem", "solicitante"],
      visiveis: { envio: true, inicio: true, status: true, carros: true, locais: true, cliente: true, distIda: true, origem: true, solicitante: true, tipo: false, fim: false, retorno: false, distVolta: false, contato: false },
    },
  },
  {
    id: "proximos-retornos", rotulo: "Próximos retornos",
    prefs: {
      visualizacao: "tabela",
      filtros: [{ campo: "fim", operador: "periodo", valor: "proximos_30_dias" }],
      ordenacao: [{ campo: "fim", direcao: "asc" }],
      ordem: ["fim", "retorno", "status", "carros", "locais", "cliente", "distVolta", "enderecoRetorno", "solicitante"],
      visiveis: { fim: true, retorno: true, status: true, carros: true, locais: true, cliente: true, distVolta: true, enderecoRetorno: true, solicitante: true, tipo: false, inicio: false, envio: false, distIda: false, contato: false },
    },
  },
];
