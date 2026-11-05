import type { ReactNode } from "react";
import type { CampoConsultavel } from "../../lib/motor/consulta";
import type { DefinicaoDeColuna } from "../../lib/motor/layout";

export type OpcaoDoCampo = { value: string; label: string; tom?: "success" | "warning" | "error" | "info" | "neutral" | "accent" };

/** Um campo da tela: o que a consulta entende (tipo, valor) + o que a tabela mostra (título, largura, célula). */
export type CampoDaTela<T> = CampoConsultavel<T> & DefinicaoDeColuna & {
  titulo: string;
  /** Opções fixas (status, seguro…). Sem isto, campos de opção usam os valores que existem nas linhas. */
  opcoes?: readonly OpcaoDoCampo[];
  /** Célula própria; sem isto a tabela formata pelo tipo. */
  celula?: (linha: T) => ReactNode;
};
