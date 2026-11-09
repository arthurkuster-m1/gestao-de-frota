import { criarChecklistsEmMassa } from "../../checklists/dados";
import { reservarEmMassa } from "../../veiculos/executarEmMassa";
import { ACOES, validarLista, type AcaoEmMassa, type DefinicaoDaAcao, type Resultado as RV } from "../../veiculos/atualizacaoEmMassa";
import { criarVeiculos, atualizarCampos } from "../../veiculos/dados";
import { CAMPOS as CAMPOS_VEICULO, validarTudo as validarVeiculos } from "../../veiculos/importacao";
import { CICLO, SEGURO } from "../../veiculos/tipos";
import { paraInstante } from "../../checklists/regras";
import { COMBUSTIVEIS, LIMPEZAS } from "../../checklists/tipos";
import { SIM_NAO, type Coluna, type Dados, type Lancamento, type Linha, type Parametro, type Parametros } from "../tipos";

const GRUPO = "Veículos";
const opEventos = (d: Dados) => d.eventos.map((e) => ({ value: e.id, label: e.nome }));
const lista = (l: Linha) => ({ ref: l.ref, placa: l.placa, data: l.data, hora: l.hora, evento: l.evento });

/** Liberação, chegada na planta, faturamento, emplacamento, devolução para a CVO e devolução: uma referência por linha (e placa/data quando preciso). */
function atualizacaoDeVeiculo(def: DefinicaoDaAcao, grupo = GRUPO): Lancamento {
  return {
    id: def.id, grupo, rotulo: def.rotulo, descricao: def.descricao, botao: (n) => `Atualizar ${n} veículo${n === 1 ? "" : "s"}`,
    colunas: () => [
      { id: "ref", titulo: def.referencia, largura: 300 },
      ...(def.comPlaca ? [{ id: "placa", titulo: "Placa", largura: 130 }] : []),
      ...(def.comData ? [{ id: "data", titulo: "Data (dd/mm/aaaa)", largura: 150, dica: "Vazio: vale a data padrão" }] : []),
    ],
    parametros: () => (def.comData ? [{ id: "data", rotulo: "Data padrão", tipo: "data" as const }] : []),
    validar: (linhas, d, p) => validarLista(def.id, linhas.map(lista), { veiculos: d.veiculos, data: p.data || d.hoje }).map((r) => ({ tom: r.tom, texto: r.texto, pronto: r })),
    aplicar: async (prontos) => {
      const feitos: number[] = [];
      for (const { indice, pronto } of prontos) {
        const r = pronto as RV; if (!r.veiculo || !r.plano) continue;
        try { await atualizarCampos(r.veiculo.id, r.plano.patch); feitos.push(indice); }
        catch (e) { return { feitos, falha: `${r.veiculo.codigo ?? r.veiculo.modelo}: ${(e as Error).message}` }; }
      }
      return { feitos, falha: null };
    },
  };
}

const extrasDoChecklist = (momento: "saida" | "retorno"): Parametro[] => [
  { id: "data", rotulo: momento === "saida" ? "Dia do envio (padrão)" : "Dia do retorno (padrão)", tipo: "data" }, { id: "hora", rotulo: "Hora (padrão)", tipo: "hora" },
  { id: "combustivel", rotulo: "Combustível / carga (opcional)", tipo: "opcao", opcoes: COMBUSTIVEIS }, { id: "limpeza", rotulo: "Limpeza (opcional)", tipo: "opcao", opcoes: LIMPEZAS },
  { id: "recebido", rotulo: momento === "saida" ? "Quem recebeu os carros (opcional)" : "Quem recebeu de volta (opcional)", tipo: "texto" }, { id: "obs", rotulo: "Observações (opcional)", tipo: "texto" },
];

/** Enviado para evento / retornou de evento: registra o checklist de cada carro (a reserva vai para Em uso / Concluído). */
function checklistEmMassa(def: DefinicaoDaAcao, momento: "saida" | "retorno"): Lancamento {
  return {
    id: def.id, grupo: "Eventos", rotulo: def.rotulo, descricao: def.descricao, botao: (n) => `Registrar o checklist de ${n} carro${n === 1 ? "" : "s"}`,
    colunas: (d) => [{ id: "ref", titulo: def.referencia, largura: 280 }, { id: "evento", titulo: "Evento (vazio: reserva aberta do carro)", largura: 260, opcoes: opEventos(d) }, { id: "data", titulo: "Dia (dd/mm/aaaa)", largura: 140 }, { id: "hora", titulo: "Hora (hh:mm)", largura: 110 }],
    parametros: () => extrasDoChecklist(momento),
    validar: (linhas, d, p) => validarLista(def.id, linhas.map((l) => ({ ...lista(l), hora: l.hora || p.hora || undefined })), {
      veiculos: d.veiculos, data: p.data || d.hoje, reservas: d.reservas.map((r) => ({ id: r.id, veiculo_id: r.veiculo_id, evento_id: r.evento_id, estado: r.estado })),
      checklistsFeitos: new Set(d.checklists.map((c) => `${c.reserva_id}:${c.momento}`)), nomeDoEvento: (id) => d.eventos.find((e) => e.id === id)?.nome ?? "?",
    }).map((r) => ({ tom: r.tom, texto: r.texto, pronto: r })),
    aplicar: async (prontos, _d, p) => {
      const grupos = new Map<string, { indices: number[]; reservaIds: string[]; instante: string }>();
      for (const { indice, pronto } of prontos) {
        const r = pronto as RV; const hora = r.hora || p.hora || "12:00"; const chave = `${r.dataIso}|${hora}`;
        const g = grupos.get(chave) ?? { indices: [], reservaIds: [], instante: paraInstante(r.dataIso!, hora) };
        g.indices.push(indice); g.reservaIds.push(r.reservaId!); grupos.set(chave, g);
      }
      const feitos: number[] = [];
      for (const g of grupos.values()) {
        try { await criarChecklistsEmMassa(g.reservaIds, momento, { data_hora: g.instante, combustivel: p.combustivel || null, limpeza: p.limpeza || null, recebido_por: (p.recebido ?? "").trim() || null, teve_avarias: false, avarias: null, observacoes: (p.obs ?? "").trim() || null }); feitos.push(...g.indices); }
        catch (e) { return { feitos, falha: (e as Error).message }; }
      }
      return { feitos, falha: null };
    },
  };
}

const reservaEmEvento: Lancamento = {
  id: "reserva", grupo: "Eventos", rotulo: "Reservar carros em evento", descricao: "Põe cada carro da lista no evento da linha. Com as datas do evento, reserva no período; sem elas, o carro entra sem data.",
  botao: (n) => `Reservar ${n} carro${n === 1 ? "" : "s"}`,
  colunas: (d) => [{ id: "ref", titulo: "Referência (VIN, Código ou Placa)", largura: 300 }, { id: "evento", titulo: "Evento", largura: 280, opcoes: opEventos(d) }],
  validar: (linhas, d) => validarLista("reserva", linhas.map(lista), { veiculos: d.veiculos, data: d.hoje, nomeDoEvento: (id) => d.eventos.find((e) => e.id === id)?.nome ?? "?", noEvento: (ev, vid) => d.reservas.some((r) => r.evento_id === ev && r.veiculo_id === vid && r.estado !== "cancelado") }).map((r) => ({ tom: r.tom, texto: r.texto, pronto: r })),
  aplicar: async (prontos, d) => {
    const porEvento = new Map<string, { indices: number[]; ids: string[] }>();
    for (const { indice, pronto } of prontos) { const r = pronto as RV; const g = porEvento.get(r.eventoId!) ?? { indices: [], ids: [] }; g.indices.push(indice); g.ids.push(r.veiculo!.id); porEvento.set(r.eventoId!, g); }
    const feitos: number[] = [];
    for (const [eventoId, g] of porEvento) {
      try { await reservarEmMassa(g.ids, d.eventos.find((e) => e.id === eventoId)!, d.eventos.map((e) => e.nome)); feitos.push(...g.indices); }
      catch (e) { return { feitos, falha: (e as Error).message }; }
    }
    return { feitos, falha: null };
  },
};

const novoVeiculo: Lancamento = {
  id: "novo-veiculo", grupo: GRUPO, rotulo: "Novos veículos (pedidos)", descricao: "Cadastra vários veículos de uma vez. Só o modelo é obrigatório: um pedido novo pode ter só modelo, cor, MY e pedido.",
  botao: (n) => `Cadastrar ${n} veículo${n === 1 ? "" : "s"}`,
  colunas: () => CAMPOS_VEICULO.map((c): Coluna => ({ id: c.id, titulo: c.titulo, largura: c.largura, ...(c.id === "blindado" ? { opcoes: SIM_NAO } : c.id === "seguro" ? { opcoes: SEGURO } : c.id === "ciclo" ? { opcoes: CICLO } : {}) })),
  validar: (linhas, d) => validarVeiculos(linhas as never, { vins: new Set(d.veiculos.map((v) => v.vin).filter((x): x is string => !!x)), placas: new Set(d.veiculos.map((v) => v.placa).filter((x): x is string => !!x)) }).map((r) => ({ tom: r.tom, texto: r.texto, pronto: r.veiculo })),
  aplicar: async (prontos) => {
    try { await criarVeiculos(prontos.map((x) => x.pronto as never)); return { feitos: prontos.map((x) => x.indice), falha: null }; }
    catch (e) { return { feitos: [], falha: `${(e as Error).message} Nada foi gravado.` }; }
  },
};

export const LANCAMENTOS_DE_VEICULOS: Lancamento[] = [
  novoVeiculo,
  ...(["liberacao", "chegada", "faturamento", "emplacamento", "devolucaoCvo", "devolucao"] as AcaoEmMassa[]).map((id) => atualizacaoDeVeiculo(ACOES.find((a) => a.id === id)!)),
  checklistEmMassa(ACOES.find((a) => a.id === "saida")!, "saida"),
  checklistEmMassa(ACOES.find((a) => a.id === "retorno")!, "retorno"),
  reservaEmEvento,
];
export type { Parametros };
