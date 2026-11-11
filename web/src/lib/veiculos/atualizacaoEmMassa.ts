/**
 * Atualização em massa de veículos (colar uma lista de VINs/códigos/placas e aplicar UMA ação a todos). Funções puras: a tela só as chama.
 * Cada linha vira um resultado com a situação (tom) e, se ok, o plano do que muda no cadastro do carro.
 */
import { CICLO, estaFaturado, normalizarPlaca, normalizarVin, placaValida, type Veiculo } from "./tipos";
import { planoDoRegistro, type Plano } from "./registros";
import { lerData } from "../eventos/importacao";
import { reservavelPeloCiclo, rotuloDoUso, usoDoCiclo } from "../eventos/uso";

export type AcaoEmMassa = "liberacao" | "chegada" | "faturamento" | "placas" | "emplacamento" | "devolucaoCvo" | "devolucao" | "saida" | "retorno" | "reserva";
/** `data` (dd/mm/aaaa), `hora` (hh:mm) e `evento` (id) são opcionais por linha; vazios, valem os padrões da ação. */
export type LinhaDaLista = { ref?: string; placa?: string; data?: string; hora?: string; evento?: string };
export type Tom = "ok" | "erro" | "dup" | "ign";
export type Resultado = { tom: Tom; texto: string; veiculo?: Veiculo; plano?: Plano; /** envio/retorno: a reserva que ganha o checklist */ reservaId?: string; /** data (aaaa-mm-dd) e hora que valem para a linha */ dataIso?: string; hora?: string; /** reserva: o evento da linha */ eventoId?: string };
export type CampoDeBusca = "vin" | "codigo" | "placa" | "pedido";

export type DefinicaoDaAcao = { id: AcaoEmMassa; rotulo: string; descricao: string; referencia: string; campos: CampoDeBusca[]; comPlaca?: boolean; comData: boolean; /** envio e retorno: checklist com hora e dados opcionais */ comChecklist?: boolean };
export const ACOES: DefinicaoDaAcao[] = [
  { id: "liberacao", rotulo: "Liberados da produção", descricao: "Registra a liberação (data) e leva o ciclo de vida para Liberado.", referencia: "Referência (Pedido, Código ou VIN)", campos: ["pedido", "codigo", "vin"], comData: true },
  { id: "chegada", rotulo: "Chegou na planta", descricao: "Registra a chegada do carro na planta (data; sem data, hoje): o ciclo vira Disponível sem faturamento e começa a contar o prazo da placa.", referencia: "Referência (Código ou VIN)", campos: ["codigo", "vin", "pedido"], comData: true },
  { id: "faturamento", rotulo: "Faturados", descricao: "Registra o faturamento (data) e atualiza o ciclo de vida.", referencia: "Referência (Pedido, Código ou VIN)", campos: ["pedido", "codigo", "vin"], comData: true },
  { id: "placas", rotulo: "Placas solicitadas", descricao: "Registra o dia em que as placas foram solicitadas (sem data, hoje). Mede quantos dias leva para solicitar a placa e, depois, para emplacar.", referencia: "Referência (Código ou VIN)", campos: ["codigo", "vin"], comData: true },
  { id: "emplacamento", rotulo: "Emplacados", descricao: "Cadastra a placa, registra o emplacamento e atualiza o ciclo de vida.", referencia: "Referência (VIN ou Código)", campos: ["vin", "codigo"], comPlaca: true, comData: true },
  { id: "devolucaoCvo", rotulo: "Devolução para a CVO", descricao: "Marca os carros como Em devolução (a caminho da devolução para a CVO). A devolução concluída é a ação Devolvidos.", referencia: "Referência (Código, Placa ou VIN)", campos: ["codigo", "placa", "vin"], comData: false },
  { id: "devolucao", rotulo: "Devolvidos", descricao: "Registra a devolução (data) e leva o ciclo de vida para Devolvido.", referencia: "Referência (Código, Placa ou VIN)", campos: ["codigo", "placa", "vin"], comData: true },
  { id: "saida", rotulo: "Enviado para evento", descricao: "Registra o checklist de ENVIO de cada carro no evento (dia e hora editáveis): a reserva passa para Em uso.", referencia: "Referência (VIN, Código ou Placa)", campos: ["vin", "codigo", "placa"], comData: true, comChecklist: true },
  { id: "retorno", rotulo: "Retornou de evento", descricao: "Registra o checklist de RETORNO de cada carro (dia e hora editáveis): a reserva passa para Concluído.", referencia: "Referência (VIN, Código ou Placa)", campos: ["vin", "codigo", "placa"], comData: true, comChecklist: true },
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

export type ReservaResumida = { id: string; veiculo_id: string; evento_id: string; estado: string };
export type ContextoDaAcao = {
  veiculos: readonly Veiculo[]; data: string; /** carros que já estão no evento escolhido (reserva) */ jaNoEvento?: ReadonlySet<string>; /** reserva: se o carro já está no evento (por linha) */ noEvento?: (eventoId: string, veiculoId: string) => boolean;
  /** envio/retorno: as reservas, os checklists já feitos ("reservaId:saida") e o evento escolhido ("" = achar pelo carro) */
  reservas?: readonly ReservaResumida[]; checklistsFeitos?: ReadonlySet<string>; eventoId?: string; nomeDoEvento?: (id: string) => string;
};

export function validarLista(acao: AcaoEmMassa, linhas: readonly LinhaDaLista[], ctx: ContextoDaAcao): Resultado[] {
  const def = acaoDe(acao); const vistos = new Set<string>(); const placasNovas = new Map<string, string>();
  return linhas.map((l): Resultado => {
    if (!(l.ref ?? "").trim() && !(l.placa ?? "").trim()) return { tom: "ign", texto: "Linha vazia" };
    const lida = (l.data ?? "").trim() ? lerData(l.data) : null;
    if (lida === "x") return { tom: "erro", texto: `Data inválida: "${l.data}" (use dd/mm/aaaa)` };
    const dataDaLinha = lida ?? ctx.data;
    const horaDaLinha = (l.hora ?? "").trim() || undefined;
    if (horaDaLinha && !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaDaLinha)) return { tom: "erro", texto: `Hora inválida: "${l.hora}" (use hh:mm)` };
    const r = acharVeiculo(ctx.veiculos, l.ref ?? "", def.campos);
    if ("erro" in r) return { tom: "erro", texto: r.erro };
    const v = r.veiculo; const nome = v.codigo ?? v.modelo.toUpperCase();
    if (vistos.has(v.id)) return { tom: "erro", texto: `${nome} aparece mais de uma vez na lista` };
    vistos.add(v.id);
    if (acao === "saida" || acao === "retorno") {
      const momento = acao === "saida" ? "saida" : "retorno";
      const abertas = (ctx.reservas ?? []).filter((x) => x.veiculo_id === v.id && (!(l.evento || ctx.eventoId) || x.evento_id === (l.evento || ctx.eventoId))
        && (acao === "saida" ? x.estado === "reservado" || x.estado === "em_uso" : ["reservado", "em_uso", "em_retorno"].includes(x.estado)));
      if (abertas.length === 0) return { tom: "erro", texto: `${nome} não tem reserva aberta${l.evento || ctx.eventoId ? " neste evento" : ""}` };
      const pendentes = abertas.filter((x) => !ctx.checklistsFeitos?.has(`${x.id}:${momento}`));
      if (pendentes.length === 0) return { tom: "dup", texto: `${nome} já tem o checklist de ${momento === "saida" ? "envio" : "retorno"}: será ignorado`, veiculo: v };
      if (pendentes.length > 1) return { tom: "erro", texto: `${nome} está em ${pendentes.length} eventos: escolha o evento acima` };
      const r = pendentes[0]!; const ev = ctx.nomeDoEvento?.(r.evento_id);
      return { tom: "ok", texto: `${nome}: checklist de ${momento === "saida" ? "envio" : "retorno"}${ev ? ` em ${ev}` : ""} → ${momento === "saida" ? "Em uso" : "Concluído"}`, veiculo: v, reservaId: r.id, dataIso: dataDaLinha, hora: horaDaLinha };
    }
    if (acao !== "reserva" && v.status_ciclo === "devolvido") return { tom: acao === "devolucao" ? "dup" : "erro", texto: acao === "devolucao" ? `${nome} já foi devolvido: será ignorado` : `${nome} já foi devolvido` };
    if (acao === "reserva") {
      const ev = l.evento || ctx.eventoId;
      if (!ev) return { tom: "erro", texto: `${nome}: falta o evento` };
      if (!reservavelPeloCiclo(v.status_ciclo)) return { tom: "erro", texto: `${nome} está ${rotuloDoUso(usoDoCiclo(v.status_ciclo)!)} e não recebe reservas` };
      const ja = ctx.noEvento ? ctx.noEvento(ev, v.id) : ctx.jaNoEvento?.has(v.id);
      return ja ? { tom: "dup", texto: `${nome} já está neste evento: será ignorado`, veiculo: v, eventoId: ev } : { tom: "ok", texto: `${nome}: será reservado${ctx.nomeDoEvento ? ` em ${ctx.nomeDoEvento(ev)}` : ""}`, veiculo: v, eventoId: ev };
    }
    if (acao === "liberacao") {
      if (v.data_liberacao) return { tom: "dup", texto: `${nome} já foi liberado em ${v.data_liberacao.split("-").reverse().join("/")}: será ignorado`, veiculo: v };
      const plano = planoDoRegistro("liberacao", v, { data: dataDaLinha }); return { tom: "ok", texto: `${nome}: ${plano.resumo.join(" · ")}`, veiculo: v, plano };
    }
    if (acao === "chegada") {
      if (pos(v.status_ciclo) < pos("liberado")) return { tom: "erro", texto: `${nome} ainda não foi liberado da produção` };
      if (v.data_chegada_planta || pos(v.status_ciclo) >= pos("disponivel_sem_faturamento")) return { tom: "dup", texto: `${nome} já chegou na planta${v.data_chegada_planta ? ` em ${v.data_chegada_planta.split("-").reverse().join("/")}` : ""}: será ignorado`, veiculo: v };
      const plano = planoDoRegistro("chegada", v, { data: dataDaLinha }); return { tom: "ok", texto: `${nome}: ${plano.resumo.join(" · ")}`, veiculo: v, plano };
    }
    if (acao === "devolucaoCvo") {
      if (v.status_ciclo === "em_devolucao") return { tom: "dup", texto: `${nome} já está em devolução: será ignorado`, veiculo: v };
      const plano = planoDoRegistro("devolucaoCvo", v, { data: dataDaLinha }); return { tom: "ok", texto: `${nome}: ${plano.resumo.join(" · ")}`, veiculo: v, plano };
    }
    if (acao === "devolucao") { const plano = planoDoRegistro("devolucao", v, { data: dataDaLinha }); return { tom: "ok", texto: `${nome}: ${plano.resumo.join(" · ")}`, veiculo: v, plano }; }
    if (acao === "faturamento") {
      if (v.data_faturamento) return { tom: "dup", texto: `${nome} já foi faturado em ${v.data_faturamento.split("-").reverse().join("/")}: será ignorado`, veiculo: v };
      const plano = planoDoRegistro("faturamento", v, { data: dataDaLinha }); return { tom: "ok", texto: `${nome}: ${plano.resumo.join(" · ")}`, veiculo: v, plano };
    }
    if (acao === "placas") {
      if (!estaFaturado(v)) return { tom: "erro", texto: `${nome} ainda não foi faturado: não dá para solicitar as placas` };
      if (v.data_placas_solicitadas) return { tom: "dup", texto: `${nome}: placas já solicitadas em ${v.data_placas_solicitadas.split("-").reverse().join("/")}: será ignorado`, veiculo: v };
      const plano = planoDoRegistro("placas", v, { data: dataDaLinha });
      const dias = v.data_chegada_planta ? Math.round((Date.parse(`${dataDaLinha}T12:00:00Z`) - Date.parse(`${v.data_chegada_planta}T12:00:00Z`)) / 86400000) : null;
      return { tom: "ok", texto: `${nome}: ${plano.resumo.join(" · ")}${dias !== null ? ` (${dias} dia${dias === 1 ? "" : "s"} desde a chegada na planta)` : ""}`, veiculo: v, plano };
    }
    // emplacamento
    const placa = normalizarPlaca(l.placa ?? "");
    if (!placa) return { tom: "erro", texto: `${nome}: falta a placa` };
    if (!placaValida(placa)) return { tom: "erro", texto: `${nome}: placa inválida (7 caracteres): ${placa}` };
    if (!estaFaturado(v) && pos(v.status_ciclo) <= pos("disponivel_sem_faturamento")) return { tom: "erro", texto: `${nome} ainda não foi faturado: não dá para emplacar` };
    if (v.data_emplacamento && v.placa) return { tom: "dup", texto: `${nome} já está emplacado (${v.placa}): será ignorado`, veiculo: v };
    const dono = ctx.veiculos.find((x) => x.placa === placa && x.id !== v.id);
    if (dono) return { tom: "erro", texto: `A placa ${placa} já é de ${dono.codigo ?? dono.modelo}` };
    const usada = placasNovas.get(placa);
    if (usada) return { tom: "erro", texto: `A placa ${placa} repete na lista (${usada})` };
    placasNovas.set(placa, nome);
    const plano = planoDoRegistro("emplacamento", v, { data: dataDaLinha, placa }); return { tom: "ok", texto: `${nome}: ${plano.resumo.join(" · ")}`, veiculo: v, plano };
  });
}

/** Matriz colada → linhas (1 coluna: só a referência; 2 colunas: referência e placa). Ignora um cabeçalho óbvio. */
export function linhasDeMatriz(matriz: string[][]): LinhaDaLista[] {
  const dados = matriz.filter((l) => l.some((c) => (c ?? "").trim() !== ""));
  const cab = dados[0]?.map((c) => k(c).normalize("NFD").replace(/[̀-ͯ]/g, ""));
  const temCabecalho = !!cab && cab.some((c) => ["vin", "chassi", "codigo", "pedido", "placa", "referencia"].includes(c)) && !cab.some((c) => normalizarVin(c).length === 17);
  return (temCabecalho ? dados.slice(1) : dados).map((l) => ({ ref: (l[0] ?? "").trim() || undefined, placa: (l[1] ?? "").trim() || undefined }));
}
