import { CICLO, rotuloCiclo, type Ciclo, type Veiculo, type VeiculoNovo } from "./tipos";

export type TipoDeRegistro = "liberacao" | "faturamento" | "emplacamento" | "devolucao";
export type Plano = { patch: Partial<VeiculoNovo>; resumo: string[] };

const pos = (c: Ciclo) => CICLO.findIndex((x) => x.value === c);
const br = (d: string) => d.split("-").reverse().join("/");
/** Só avança o ciclo de vida (nunca volta): se já está adiante, deixa como está. */
const avanca = (atual: Ciclo, alvo: Ciclo): Ciclo | null => (pos(alvo) > pos(atual) ? alvo : null);

/**
 * O que cada botão de "registrar" muda no cadastro do carro: a data do marco, o ciclo de vida (só para a frente) e, no emplacamento,
 * a placa. É o mesmo que o banco faria sozinho, mas aqui fica explícito e conferido antes de gravar.
 */
export function planoDoRegistro(tipo: TipoDeRegistro, v: Pick<Veiculo, "status_ciclo" | "blindado" | "placa">, dados: { data: string; placa?: string }): Plano {
  const resumo: string[] = []; const patch: Partial<VeiculoNovo> = {};
  const ciclo = (alvo: Ciclo, force = false) => { const novo = force ? (v.status_ciclo === alvo ? null : alvo) : avanca(v.status_ciclo, alvo); if (novo) { patch.status_ciclo = novo; resumo.push(`Ciclo de vida → ${rotuloCiclo(novo)}`); } };
  switch (tipo) {
    case "liberacao": patch.data_liberacao = dados.data; resumo.push(`Liberado em ${br(dados.data)}`); ciclo("liberado"); break;
    case "faturamento": patch.data_faturamento = dados.data; resumo.push(`Faturado em ${br(dados.data)}`); ciclo("revisao_emplacamento"); break;
    case "emplacamento":
      patch.data_emplacamento = dados.data; resumo.push(`Emplacado em ${br(dados.data)}`);
      if (dados.placa) { patch.placa = dados.placa; resumo.push(`Placa ${dados.placa}`); }
      ciclo(v.blindado ? "em_blindagem" : "disponivel"); break;
    case "devolucao": patch.data_devolucao = dados.data; resumo.push(`Devolvido em ${br(dados.data)}`); ciclo("devolvido", true); break;
  }
  return { patch, resumo };
}
export const ROTULO_DO_REGISTRO: Record<TipoDeRegistro, string> = { liberacao: "Registrar liberação", faturamento: "Registrar faturamento", emplacamento: "Registrar emplacamento", devolucao: "Registrar devolução" };
