import { atualizarManutencao, criarManutencao } from "../../manutencoes/dados";
import { lerData } from "../../eventos/importacao";
import { acharVeiculo } from "../../veiculos/atualizacaoEmMassa";
import { STATUS_MANUTENCAO, TIPOS_MANUTENCAO, type ManutencaoNova, type StatusManutencao } from "../../manutencoes/tipos";
import { SIM_NAO, type Lancamento } from "../tipos";

const CAMPOS_REF = ["codigo", "placa", "vin"] as const;
const tipos = TIPOS_MANUTENCAO.map((t) => ({ value: t, label: t }));
const vazia = (l: Record<string, string | undefined>) => Object.values(l).every((v) => !(v ?? "").trim());
const data = (t: string | undefined) => { const x = (t ?? "").trim(); return x ? lerData(x) : null; };

const novaManutencao: Lancamento = {
  id: "nova-manutencao", grupo: "Manutenções", rotulo: "Novas manutenções", descricao: "Abre várias manutenções de uma vez, uma por carro (código, placa ou VIN). Sem data de início, vale hoje.",
  botao: (n) => `Criar ${n} manutenç${n === 1 ? "ão" : "ões"}`,
  colunas: () => [
    { id: "ref", titulo: "Veículo (Código, Placa ou VIN)", largura: 260 }, { id: "nome", titulo: "Nome da manutenção", largura: 220 }, { id: "tipo", titulo: "Tipo", largura: 190, opcoes: tipos },
    { id: "status", titulo: "Status", largura: 150, opcoes: STATUS_MANUTENCAO }, { id: "inicio", titulo: "Início (dd/mm/aaaa)", largura: 150 }, { id: "fim", titulo: "Fim (dd/mm/aaaa)", largura: 150 },
    { id: "bloqueia", titulo: "Bloqueia o uso?", largura: 140, opcoes: SIM_NAO }, { id: "descricao", titulo: "Descrição", largura: 220 },
  ],
  validar: (linhas, d) => linhas.map((l) => {
    if (vazia(l)) return { tom: "ign" as const, texto: "Linha vazia" };
    const r = acharVeiculo(d.veiculos, l.ref ?? "", CAMPOS_REF); if ("erro" in r) return { tom: "erro" as const, texto: r.erro };
    const nome = (l.nome ?? "").trim(); if (!nome) return { tom: "erro" as const, texto: "Falta o nome da manutenção" };
    const ini = data(l.inicio), fim = data(l.fim);
    if (ini === "x") return { tom: "erro" as const, texto: `Início inválido: "${l.inicio}"` }; if (fim === "x") return { tom: "erro" as const, texto: `Fim inválido: "${l.fim}"` };
    const inicio = ini ?? d.hoje; if (fim && fim < inicio) return { tom: "erro" as const, texto: "O fim é antes do início" };
    const m: ManutencaoNova = { veiculo_id: r.veiculo.id, nome, tipo: (l.tipo ?? "").trim() || null, status: (l.status as StatusManutencao) || "solicitar_da", data_inicio: inicio, data_fim: fim, bloqueia_uso: l.bloqueia ? l.bloqueia === "sim" : true, descricao: (l.descricao ?? "").trim() || null };
    return { tom: "ok" as const, texto: `${r.veiculo.codigo ?? r.veiculo.modelo}: ${nome}`, pronto: m };
  }),
  aplicar: async (prontos) => {
    const feitos: number[] = [];
    for (const { indice, pronto } of prontos) { try { await criarManutencao(pronto as ManutencaoNova); feitos.push(indice); } catch (e) { return { feitos, falha: (e as Error).message }; } }
    return { feitos, falha: null };
  },
};

type Plano = { id: string; rotulo: string; patch: Record<string, unknown> };
const atualizarManutencoes: Lancamento = {
  id: "atualizar-manutencao", grupo: "Manutenções", rotulo: "Atualizar manutenções (status)", descricao: "Muda o status (e, se quiser, o fim e o bloqueio) da manutenção em aberto de cada carro. Se o carro tem mais de uma em aberto, escreva o nome dela.",
  botao: (n) => `Atualizar ${n} manutenç${n === 1 ? "ão" : "ões"}`,
  colunas: () => [
    { id: "ref", titulo: "Veículo (Código, Placa ou VIN)", largura: 260 }, { id: "nome", titulo: "Nome da manutenção (se houver mais de uma)", largura: 260 }, { id: "status", titulo: "Status", largura: 160, opcoes: STATUS_MANUTENCAO },
    { id: "fim", titulo: "Fim (dd/mm/aaaa)", largura: 150 }, { id: "bloqueia", titulo: "Bloqueia o uso?", largura: 140, opcoes: SIM_NAO },
  ],
  validar: (linhas, d) => linhas.map((l) => {
    if (vazia(l)) return { tom: "ign" as const, texto: "Linha vazia" };
    const r = acharVeiculo(d.veiculos, l.ref ?? "", CAMPOS_REF); if ("erro" in r) return { tom: "erro" as const, texto: r.erro };
    const doCarro = d.manutencoes.filter((m) => m.veiculo_id === r.veiculo.id && (l.nome?.trim() ? m.nome.trim().toLowerCase() === l.nome.trim().toLowerCase() : m.status !== "pronto"));
    const nome = r.veiculo.codigo ?? r.veiculo.modelo;
    if (doCarro.length === 0) return { tom: "erro" as const, texto: `${nome} não tem manutenção ${l.nome?.trim() ? `chamada "${l.nome}"` : "em aberto"}` };
    if (doCarro.length > 1) return { tom: "erro" as const, texto: `${nome} tem ${doCarro.length} manutenções: escreva o nome dela` };
    const m = doCarro[0]!; const fim = data(l.fim); if (fim === "x") return { tom: "erro" as const, texto: `Fim inválido: "${l.fim}"` };
    const patch: Record<string, unknown> = {};
    if (l.status && l.status !== m.status) patch.status = l.status;
    if (fim && fim !== m.data_fim) patch.data_fim = fim;
    if (l.bloqueia && (l.bloqueia === "sim") !== m.bloqueia_uso) patch.bloqueia_uso = l.bloqueia === "sim";
    if (Object.keys(patch).length === 0) return { tom: "dup" as const, texto: `${nome}: nada para mudar` };
    return { tom: "ok" as const, texto: `${nome} · ${m.nome}: ${Object.keys(patch).map((k) => ({ status: "status", data_fim: "fim", bloqueia_uso: "bloqueio" } as Record<string, string>)[k]).join(", ")}`, pronto: { id: m.id, rotulo: `${nome} · ${m.nome}`, patch } as Plano };
  }),
  aplicar: async (prontos) => {
    const feitos: number[] = [];
    for (const { indice, pronto } of prontos) { const p = pronto as Plano; try { await atualizarManutencao(p.id, p.patch as never); feitos.push(indice); } catch (e) { return { feitos, falha: `${p.rotulo}: ${(e as Error).message}` }; } }
    return { feitos, falha: null };
  },
};

export const LANCAMENTOS_DE_MANUTENCOES: Lancamento[] = [novaManutencao, atualizarManutencoes];
