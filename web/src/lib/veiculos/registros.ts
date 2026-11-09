import { CICLO, rotuloCiclo, type Ciclo, type Veiculo, type VeiculoNovo } from "./tipos";

export type TipoDeRegistro = "liberacao" | "chegada" | "faturamento" | "emplacamento" | "devolucao";
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
    case "chegada": ciclo("disponivel_sem_faturamento"); if (resumo.length === 0) resumo.push("O carro já passou desta etapa"); break;
    case "faturamento": patch.data_faturamento = dados.data; resumo.push(`Faturado em ${br(dados.data)}`); ciclo("revisao_emplacamento"); break;
    case "emplacamento":
      patch.data_emplacamento = dados.data; resumo.push(`Emplacado em ${br(dados.data)}`);
      if (dados.placa) { patch.placa = dados.placa; resumo.push(`Placa ${dados.placa}`); }
      ciclo(v.blindado ? "em_blindagem" : "disponivel"); break;
    case "devolucao": patch.data_devolucao = dados.data; resumo.push(`Devolvido em ${br(dados.data)}`); ciclo("devolvido", true); break;
  }
  return { patch, resumo };
}
export const ROTULO_DO_REGISTRO: Record<TipoDeRegistro, string> = { liberacao: "Registrar liberação da produção", chegada: "Registrar chegada na planta", faturamento: "Registrar faturamento", emplacamento: "Registrar emplacamento", devolucao: "Registrar devolução" };

/**
 * Os PRÓXIMOS passos lógicos de um carro (e só eles):
 * pedido recebido → liberação da produção → chegada na planta → faturamento OU devolução → (faturado) emplacamento → devolução.
 * Não dá para emplacar sem faturar, nem faturar sem o carro ter chegado; devolver, dá a partir da chegada.
 */
export function proximosPassos(v: Pick<Veiculo, "status_ciclo">): TipoDeRegistro[] {
  switch (v.status_ciclo) {
    case "pedido_recebido": return ["liberacao"];
    case "liberado": case "em_transporte_0km": return ["chegada"];
    case "disponivel_sem_faturamento": return ["faturamento", "devolucao"];
    case "revisao_emplacamento": return ["emplacamento"];
    case "devolvido": return [];
    default: return ["devolucao"];   // em blindagem, pronto, gravame, venda VIP, em devolução
  }
}
