import { lerData } from "../../eventos/importacao";
import { atualizarTransporte } from "../../transportes/dados";
import { paraNumero, reais } from "../../transportes/regras";
import type { Transporte } from "../../transportes/tipos";
import { SIM_NAO, type Dados, type Lancamento, type Linha } from "../tipos";

const vazia = (l: Linha) => Object.values(l).every((v) => !(v ?? "").trim());
const chave = (t: string | null | undefined) => (t ?? "").trim().toLowerCase();

type Passo = { id: string; rotulo: string; patch: { status_pagamento?: string; valor_real?: number | null; data_pagamento?: string } };

/** Reparte o valor pago entre os transportes da mesma PTA/NF, na proporção do valor planejado de cada um (iguais se nenhum tem valor). Os centavos que sobram vão para o último. */
export function repartirValor(total: number, transportes: readonly Pick<Transporte, "valor_planejado">[]): number[] {
  const pesos = transportes.map((t) => t.valor_planejado ?? 0);
  const soma = pesos.reduce((a, b) => a + b, 0);
  const partes = transportes.map((_, i) => Math.round((soma > 0 ? (total * pesos[i]!) / soma : total / transportes.length) * 100) / 100);
  const resto = Math.round((total - partes.reduce((a, b) => a + b, 0)) * 100) / 100;
  if (partes.length) partes[partes.length - 1] = Math.round((partes[partes.length - 1]! + resto) * 100) / 100;
  return partes;
}

/** Os transportes que usam essa PTA/NF (mesma referência, ignorando maiúsculas); retirada não tem pagamento. */
export const transportesDaReferencia = (d: Pick<Dados, "transportes">, ref: string) => d.transportes.filter((t) => t.modalidade !== "retirada" && chave(t.referencia) === chave(ref));

const pagamentoDePtaNf: Lancamento = {
  id: "pagamento-pta-nf", grupo: "Transportes", rotulo: "Pagamento de PTA / NF",
  descricao: "Informe a PTA (ou NF da TSO), se já foi paga e o valor real pago: tudo é atualizado em TODOS os transportes que usam aquele número. Se a PTA/NF cobre mais de um transporte, o valor pago é dividido entre eles na proporção do valor planejado. Já foi paga? em branco vale Sim; sem data, vale hoje.",
  botao: (n) => `Atualizar ${n} PTA/NF`,
  colunas: () => [
    { id: "ref", titulo: "PTA ou NF (número / referência)", largura: 260, dica: "o mesmo número que está na referência do transporte" },
    { id: "pago", titulo: "Já foi paga?", largura: 140, opcoes: SIM_NAO },
    { id: "valor", titulo: "Valor real pago (R$)", largura: 190, dica: "1.234,56" },
    { id: "data", titulo: "Data do pagamento (dd/mm/aaaa)", largura: 210 },
  ],
  validar: (linhas, d) => {
    const vistas = new Set<string>();
    return linhas.map((l) => {
      if (vazia(l)) return { tom: "ign" as const, texto: "Linha vazia" };
      const ref = (l.ref ?? "").trim();
      if (!ref) return { tom: "erro" as const, texto: "Falta o número da PTA ou NF" };
      if (vistas.has(chave(ref))) return { tom: "erro" as const, texto: `${ref} aparece mais de uma vez nesta lista` };
      vistas.add(chave(ref));
      const ts = transportesDaReferencia(d, ref);
      if (ts.length === 0) return { tom: "erro" as const, texto: `Nenhum transporte com a referência ${ref}` };
      const pago = (l.pago ?? "").trim() !== "nao";
      const textoValor = (l.valor ?? "").trim();
      const valor = textoValor ? paraNumero(textoValor) : null;
      if (textoValor && (valor === null || valor < 0)) return { tom: "erro" as const, texto: `Valor inválido: "${l.valor}"` };
      const dia = lerData(l.data); if (dia === "x") return { tom: "erro" as const, texto: `Data inválida: "${l.data}"` };
      if (!pago && valor === null) return { tom: "erro" as const, texto: "Não paga e sem valor: nada para atualizar" };
      const partes = valor === null ? ts.map(() => null) : repartirValor(valor, ts);
      const passos: Passo[] = [];
      ts.forEach((t, i) => {
        const patch: Passo["patch"] = {};
        const statusFinal = t.modalidade === "pta" ? "pago" : "aprovado";   // a NF da TSO termina em "Aprovado" (não existe "Pago")
        if (pago && (t.status_pagamento !== statusFinal || !t.data_pagamento)) { patch.status_pagamento = statusFinal; patch.data_pagamento = dia ?? t.data_pagamento ?? d.hoje; }
        else if (pago && dia && dia !== t.data_pagamento) patch.data_pagamento = dia;
        if (partes[i] !== null && partes[i] !== t.valor_real) patch.valor_real = partes[i];
        if (Object.keys(patch).length) passos.push({ id: t.id, rotulo: `${ref} (${t.sentido})`, patch });
      });
      const resumo = `${ref}: ${ts.length} transporte${ts.length === 1 ? "" : "s"}${valor !== null ? ` · ${reais(valor)}${ts.length > 1 ? ` (dividido: ${partes.map((p) => reais(p ?? 0)).join(" + ")})` : ""}` : ""} · ${pago ? "paga" : "só o valor"}`;
      if (passos.length === 0) return { tom: "dup" as const, texto: `${ref}: já está assim` };
      return { tom: "ok" as const, texto: resumo, pronto: passos };
    });
  },
  aplicar: async (prontos) => {
    const feitos: number[] = [];
    for (const { indice, pronto } of prontos) {
      try { for (const p of pronto as Passo[]) await atualizarTransporte(p.id, p.patch); feitos.push(indice); }
      catch (e) { return { feitos, falha: (e as Error).message }; }
    }
    return { feitos, falha: null };
  },
};

export const LANCAMENTOS_DE_TRANSPORTES: Lancamento[] = [pagamentoDePtaNf];
