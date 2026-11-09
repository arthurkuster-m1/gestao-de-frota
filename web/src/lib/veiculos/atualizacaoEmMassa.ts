/**
 * Atualização em massa de veículos (colar uma lista de VINs/códigos/placas e aplicar UMA ação a todos). Funções puras: a tela só as chama.
 * Cada linha vira um resultado com a situação (tom) e, se ok, o plano do que muda no cadastro do carro.
 */
import { CICLO, normalizarPlaca, normalizarVin, placaValida, type Veiculo } from "./tipos";
import { planoDoRegistro, type Plano } from "./registros";

export type AcaoEmMassa = "emplacamento" | "faturamento" | "devolucao" | "reserva";
export type LinhaDaLista = { ref?: string; placa?: string };
export type Tom = "ok" | "erro" | "dup" | "ign";
export type Resultado = { tom: Tom; texto: string; veiculo?: Veiculo; plano?: Plano };
export type CampoDeBusca = "vin" | "codigo" | "placa" | "pedido";

export const ACOES: { id: AcaoEmMassa; rotulo: string; descricao: string; referencia: string; campos: CampoDeBusca[]; comPlaca?: boolean; comData: boolean }[] = [
  { id: "emplacamento", rotulo: "Emplacados", descricao: "Cadastra a placa, registra o emplacamento e atualiza o ciclo de vida.", referencia: "Referência (VIN ou Código)", campos: ["vin", "codigo"], comPlaca: true, comData: true },
  { id: "faturamento", rotulo: "Faturados", descricao: "Registra o faturamento (data) e atualiza o ciclo de vida.", referencia: "Referência (Pedido, Código ou VIN)", campos: ["pedido", "codigo", "vin"], comData: true },
  { id: "devolucao", rotulo: "Devolvidos", descricao: "Registra a devolução (data) e leva o ciclo de vida para Devolvido.", referencia: "Referência (Código, Placa ou VIN)", campos: ["codigo", "placa", "vin"], comData: true },
  { id: "reserva", rotulo: "Reservar em evento", descricao: "Põe todos os carros da lista num evento (existente ou novo).", referencia: "Referência (VIN, Código ou Placa)", campos: ["vin", "codigo", "placa"], comData: false },
];
export const acaoDe = (id: AcaoEmMassa) => ACOES.find((a) => a.id === id)!;

const pos = (c: string) => CICLO.findIndex((x) => x.value === c);
const k = (t: string | null | undefined) => (t ?? "").trim().toLowerCase();

/** Acha UM veículo pela referência, olhando só os campos permitidos na ação. */
export function acharVeiculo(veiculos: readonly Veiculo[], ref: string, campos: readonly CampoDeBusca[]): { veiculo: Veiculo } | { erro: string } {
  const t = ref.trim(); if (!t) return { erro: "Falta a referência" };
  const vin = normalizarVin(t), placa = normalizarPlaca(t);
  const achados = new Set<Veiculo>();
  for (const v of veiculos) {
    if (campos.includes("vin") && vin.length === 17 && v.vin === vin) achados.add(v);
    if (campos.includes("codigo") && k(v.codigo) === k(t)) achados.add(v);
    if (campos.includes("placa") && placa.length === 7 && v.placa === placa) achados.add(v);
    if (campos.includes("pedido") && v.pedido && k(v.pedido) === k(t)) achados.add(v);
  }
  if (achados.size === 0) return { erro: `Veículo não encontrado: "${t}"` };
  if (achados.size > 1) return { erro: `"${t}" bate com ${achados.size} veículos: use o VIN` };
  return { veiculo: [...achados][0]! };
}

export type ContextoDaAcao = { veiculos: readonly Veiculo[]; data: string; /** carros que já estão no evento escolhido (reserva) */ jaNoEvento?: ReadonlySet<string> };

export function validarLista(acao: AcaoEmMassa, linhas: readonly LinhaDaLista[], ctx: ContextoDaAcao): Resultado[] {
  const def = acaoDe(acao); const vistos = new Set<string>(); const placasNovas = new Map<string, string>();
  return linhas.map((l): Resultado => {
    if (!(l.ref ?? "").trim() && !(l.placa ?? "").trim()) return { tom: "ign", texto: "Linha vazia" };
    const r = acharVeiculo(ctx.veiculos, l.ref ?? "", def.campos);
    if ("erro" in r) return { tom: "erro", texto: r.erro };
    const v = r.veiculo; const nome = v.codigo ?? v.modelo.toUpperCase();
    if (vistos.has(v.id)) return { tom: "erro", texto: `${nome} aparece mais de uma vez na lista` };
    vistos.add(v.id);
    if (acao !== "reserva" && v.status_ciclo === "devolvido") return { tom: acao === "devolucao" ? "dup" : "erro", texto: acao === "devolucao" ? `${nome} já foi devolvido: será ignorado` : `${nome} já foi devolvido` };
    if (acao === "reserva") return ctx.jaNoEvento?.has(v.id) ? { tom: "dup", texto: `${nome} já está neste evento: será ignorado`, veiculo: v } : { tom: "ok", texto: `${nome}: será reservado`, veiculo: v };
    if (acao === "devolucao") { const plano = planoDoRegistro("devolucao", v, { data: ctx.data }); return { tom: "ok", texto: `${nome}: ${plano.resumo.join(" · ")}`, veiculo: v, plano }; }
    if (acao === "faturamento") {
      if (v.data_faturamento) return { tom: "dup", texto: `${nome} já foi faturado em ${v.data_faturamento.split("-").reverse().join("/")}: será ignorado`, veiculo: v };
      const plano = planoDoRegistro("faturamento", v, { data: ctx.data }); return { tom: "ok", texto: `${nome}: ${plano.resumo.join(" · ")}`, veiculo: v, plano };
    }
    // emplacamento
    const placa = normalizarPlaca(l.placa ?? "");
    if (!placa) return { tom: "erro", texto: `${nome}: falta a placa` };
    if (!placaValida(placa)) return { tom: "erro", texto: `${nome}: placa inválida (7 caracteres): ${placa}` };
    if (pos(v.status_ciclo) < pos("revisao_emplacamento")) return { tom: "erro", texto: `${nome} ainda não foi faturado: não dá para emplacar` };
    if (v.data_emplacamento && v.placa) return { tom: "dup", texto: `${nome} já está emplacado (${v.placa}): será ignorado`, veiculo: v };
    const dono = ctx.veiculos.find((x) => x.placa === placa && x.id !== v.id);
    if (dono) return { tom: "erro", texto: `A placa ${placa} já é de ${dono.codigo ?? dono.modelo}` };
    const usada = placasNovas.get(placa);
    if (usada) return { tom: "erro", texto: `A placa ${placa} repete na lista (${usada})` };
    placasNovas.set(placa, nome);
    const plano = planoDoRegistro("emplacamento", v, { data: ctx.data, placa }); return { tom: "ok", texto: `${nome}: ${plano.resumo.join(" · ")}`, veiculo: v, plano };
  });
}

/** Matriz colada → linhas (1 coluna: só a referência; 2 colunas: referência e placa). Ignora um cabeçalho óbvio. */
export function linhasDeMatriz(matriz: string[][]): LinhaDaLista[] {
  const dados = matriz.filter((l) => l.some((c) => (c ?? "").trim() !== ""));
  const cab = dados[0]?.map((c) => k(c).normalize("NFD").replace(/[̀-ͯ]/g, ""));
  const temCabecalho = !!cab && cab.some((c) => ["vin", "chassi", "codigo", "pedido", "placa", "referencia"].includes(c)) && !cab.some((c) => normalizarVin(c).length === 17);
  return (temCabecalho ? dados.slice(1) : dados).map((l) => ({ ref: (l[0] ?? "").trim() || undefined, placa: (l[1] ?? "").trim() || undefined }));
}
