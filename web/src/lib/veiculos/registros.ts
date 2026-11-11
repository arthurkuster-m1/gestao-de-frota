import { CICLO, estaFaturado, rotuloCiclo, type Ciclo, type Veiculo, type VeiculoNovo } from "./tipos";

export type TipoDeRegistro = "liberacao" | "chegada" | "faturamento" | "placas" | "emplacamento" | "devolucao" | "devolucaoCvo";
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
    case "chegada": patch.data_chegada_planta = dados.data; resumo.push(`Chegou na planta em ${br(dados.data)}`); ciclo("disponivel_sem_faturamento"); break;
    case "faturamento": patch.data_faturamento = dados.data; patch.faturado = true; resumo.push(`Faturado em ${br(dados.data)}`); if (v.status_ciclo === "disponivel_sem_faturamento") ciclo("disponivel_sem_placa"); break;   // faturado e ainda sem placa
    case "placas": patch.data_placas_solicitadas = dados.data; resumo.push(`Placas solicitadas em ${br(dados.data)}`); break;
    case "emplacamento":
      patch.data_emplacamento = dados.data; resumo.push(`Emplacado em ${br(dados.data)}`);
      if (dados.placa) { patch.placa = dados.placa; resumo.push(`Placa ${dados.placa}`); }
      ciclo(v.blindado ? "em_blindagem" : "disponivel"); break;
    case "devolucaoCvo": ciclo("em_devolucao", true); if (resumo.length === 0) resumo.push("Já está em devolução"); break;
    case "devolucao": patch.data_devolucao = dados.data; resumo.push(`Devolvido em ${br(dados.data)}`); ciclo("devolvido", true); break;
  }
  return { patch, resumo };
}
export const ROTULO_DO_REGISTRO: Record<TipoDeRegistro, string> = { liberacao: "Registrar liberação da produção", chegada: "Registrar chegada na planta", faturamento: "Registrar faturamento", placas: "Registrar placas solicitadas", emplacamento: "Registrar emplacamento", devolucao: "Registrar devolução", devolucaoCvo: "Devolução para a CVO" };

/**
 * Os PRÓXIMOS passos lógicos de um carro (e só eles):
 * pedido recebido → liberação → chegada na planta → faturamento (ou devolução) → placas solicitadas → emplacamento → devolução.
 * Não dá para solicitar placas nem emplacar sem faturar, nem faturar sem o carro ter chegado; devolver, dá a partir da chegada.
 */
export function proximosPassos(v: Pick<Veiculo, "status_ciclo"> & Partial<Pick<Veiculo, "faturado" | "data_faturamento" | "data_placas_solicitadas" | "data_emplacamento">>): TipoDeRegistro[] {
  switch (v.status_ciclo) {
    case "pedido_recebido": return ["liberacao"];
    case "liberado": case "em_transporte_0km": return ["chegada"];
    case "disponivel_sem_faturamento": case "disponivel_sem_placa":
      if (!estaFaturado(v)) return ["faturamento", "devolucao"];
      return v.data_placas_solicitadas ? ["emplacamento", "devolucao"] : ["placas", "emplacamento", "devolucao"];
    case "devolvido": return [];
    default: return ["devolucao"];   // em blindagem, pronto, gravame, venda VIP, em devolução
  }
}
