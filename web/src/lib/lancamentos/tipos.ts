import type { Checklist } from "../checklists/tipos";
import type { ClienteResumo } from "../clientes/dados";
import type { Evento, ReservaDoEvento } from "../eventos/tipos";
import type { Manutencao } from "../manutencoes/tipos";
import type { Veiculo } from "../veiculos/tipos";

/** Situação de uma linha: pronta, com erro, sem mudança (ignorada) ou vazia. */
export type Tom = "ok" | "erro" | "dup" | "ign";
export type Opcao = { value: string; label: string };
/** Uma coluna da grade. Com `opcoes`, a célula é uma caixa de seleção (setinha para baixo) com as opções fixas daquela categoria. */
export type Coluna = { id: string; titulo: string; largura: number; opcoes?: readonly Opcao[]; /** o que digitar nesta coluna */ dica?: string };
export type Linha = Record<string, string | undefined>;
export type Resultado = { tom: Tom; texto: string; /** o que será gravado (só quando tom = ok) */ pronto?: unknown };

/** Campos que valem para a lançamento inteira (data padrão, hora, dados opcionais do checklist…). */
export type Parametro = { id: string; rotulo: string; tipo: "data" | "hora" | "opcao" | "texto"; opcoes?: readonly Opcao[]; padrao?: string; dica?: string };
export type Parametros = Record<string, string>;

/** Tudo que as lançamentos precisam saber do banco (carregado uma vez e recarregado depois de gravar). */
export type Dados = {
  veiculos: Veiculo[]; eventos: Evento[]; reservas: ReservaDoEvento[]; manutencoes: Manutencao[]; clientes: ClienteResumo[]; checklists: Checklist[]; hoje: string;
};

export type ResultadoDaGravacao = { /** índices (das linhas) que foram gravados */ feitos: number[]; falha: string | null; aviso?: string };

export type Lancamento = {
  id: string; grupo: string; rotulo: string; descricao: string; botao: (n: number) => string;
  colunas: (d: Dados) => Coluna[];
  parametros?: (d: Dados) => Parametro[];
  validar: (linhas: Linha[], d: Dados, p: Parametros) => Resultado[];
  /** `prontos`: as linhas ok, com o índice delas na grade. Para na primeira falha (ou tudo-ou-nada, conforme a lançamento). */
  aplicar: (prontos: { indice: number; pronto: unknown }[], d: Dados, p: Parametros) => Promise<ResultadoDaGravacao>;
};

export const SIM_NAO: readonly Opcao[] = [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }];
