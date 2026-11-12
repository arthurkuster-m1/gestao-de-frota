import type { ReactNode } from "react";
import type { CampoConsultavel } from "../../lib/motor/consulta";
import type { DefinicaoDeColuna } from "../../lib/motor/layout";

export type OpcaoDoCampo = { value: string; label: string; tom?: "success" | "warning" | "error" | "info" | "neutral" | "accent" };

/** Um campo da tela: o que a consulta entende (tipo, valor) + o que a tabela mostra (título, largura, célula). */
/** Como um campo se edita no lugar (tabela, cards, linha do tempo). Campo sem isto é só leitura (ex.: o código, que é calculado). */
export type EdicaoDoCampo = {
  /** Campo de endereço: edita na janela do endereço (CEP → cidade/UF) e grava numa linha só, na máscara. */
  endereco?: boolean;
  /** Campo de endereço: endereço oferecido (Tab preenche, com o campo de colar vazio). */
  sugestaoDeEndereco?: string;
  /** Campo de opção: oferece criar um item novo (ex.: cliente) com o texto digitado; quem cria escolhe o valor depois. */
  criarNovo?: { rotulo: string; aoCriar: (textoDigitado: string) => void };
  /** Coluna do banco que recebe o valor. */
  coluna: string;
  obrigatorio?: boolean;
  maxLength?: number;
  placeholder?: string;
  /** Arruma o texto digitado antes de validar e gravar (ex.: placa em maiúsculas, sem hífen). */
  normalizar?: (texto: string) => string;
  /** Devolve a mensagem de erro, ou null se o valor serve. Recebe o texto já normalizado e não vazio. */
  validar?: (texto: string) => string | null;
};

export type CampoDaTela<T> = CampoConsultavel<T> & DefinicaoDeColuna & {
  edicao?: EdicaoDoCampo;
  titulo: string;
  /** Ícone do cabeçalho no lugar do ícone do tipo (ex.: o carro na coluna Carros). */
  icone?: "carro";
  /** Opções fixas (status, seguro…). Sem isto, campos de opção usam os valores que existem nas linhas. */
  opcoes?: readonly OpcaoDoCampo[];
  /** Célula própria; sem isto a tabela formata pelo tipo. */
  celula?: (linha: T) => ReactNode;
  /** A célula tem vários itens: a coluna ganha a opção de quebrar linha (um item por linha). */
  multilinha?: boolean;
};
