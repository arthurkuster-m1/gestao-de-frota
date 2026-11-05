import type { CampoDaTela, OpcaoDoCampo } from "../../components/motor/tipos";
import { STATUS_MANUTENCAO, TIPOS_MANUTENCAO, type Manutencao } from "../../lib/manutencoes/tipos";
import { eventoResponsavel } from "../../lib/manutencoes/regras";
import type { Reserva } from "../../lib/eventos/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";

export const OPCOES_STATUS_MANUTENCAO: OpcaoDoCampo[] = STATUS_MANUTENCAO.map((s) => ({ value: s.value, label: s.label, tom: s.tom }));
const OPCOES_TIPO: OpcaoDoCampo[] = TIPOS_MANUTENCAO.map((t) => ({ value: t, label: t, tom: t === "Sinistro" ? "error" : "neutral" }));

export type ContextoDeManutencoes = { veiculos: Map<string, Veiculo>; reservasDoCarro: Map<string, Reserva[]>; nomeDoEvento: (id: string) => string; carregado: boolean };
export const codigoDoCarro = (v: Veiculo | undefined) => (v ? (v.codigo ?? v.modelo.toUpperCase()) : "?");

/** Os campos de manutenção. Veículo e Evento responsável são CALCULADOS (só leitura); o resto se edita no lugar. */
export const camposDaManutencao = (ctx: ContextoDeManutencoes): CampoDaTela<Manutencao>[] => [
  { id: "nome", titulo: "Manutenção", tipo: "texto", valorDe: (m) => m.nome, largura: 240, fixa: true, edicao: { coluna: "nome", obrigatorio: true, maxLength: 120 } },
  { id: "veiculo", titulo: "Veículo", tipo: "texto", valorDe: (m) => codigoDoCarro(ctx.veiculos.get(m.veiculo_id)), largura: 190 },
  { id: "tipo", titulo: "Tipo", tipo: "opcao", valorDe: (m) => m.tipo, opcoes: OPCOES_TIPO, rotuloDoValor: (x) => x, largura: 190, edicao: { coluna: "tipo" } },
  { id: "status", titulo: "Status", tipo: "opcao", valorDe: (m) => m.status, opcoes: OPCOES_STATUS_MANUTENCAO, rotuloDoValor: (x) => OPCOES_STATUS_MANUTENCAO.find((o) => o.value === x)?.label ?? x, ordemDoValor: (x) => STATUS_MANUTENCAO.findIndex((s) => s.value === x), largura: 170, edicao: { coluna: "status", obrigatorio: true } },
  { id: "bloqueia", titulo: "Bloqueia o uso", tipo: "caixa", valorDe: (m) => m.bloqueia_uso, largura: 140, edicao: { coluna: "bloqueia_uso" } },
  { id: "inicio", titulo: "Início", tipo: "data", valorDe: (m) => m.data_inicio, largura: 150, edicao: { coluna: "data_inicio", obrigatorio: true } },
  { id: "fim", titulo: "Fim", tipo: "data", valorDe: (m) => m.data_fim, largura: 150, edicao: { coluna: "data_fim" } },
  { id: "evento", titulo: "Evento responsável", tipo: "texto", valorDe: (m) => { if (!ctx.carregado) return null; const e = eventoResponsavel(m, ctx.reservasDoCarro.get(m.veiculo_id) ?? []); return e ? ctx.nomeDoEvento(e) : null; }, largura: 240 },
  { id: "ocorrencia", titulo: "Data do acidente", tipo: "data", valorDe: (m) => m.data_ocorrencia, largura: 170, padrao: false, edicao: { coluna: "data_ocorrencia" } },
  { id: "da", titulo: "DA solicitada em", tipo: "data", valorDe: (m) => m.data_da_solicitada, largura: 170, padrao: false, edicao: { coluna: "data_da_solicitada" } },
  { id: "descricao", titulo: "Descrição do acidente", tipo: "texto", valorDe: (m) => m.descricao, largura: 320, padrao: false, edicao: { coluna: "descricao", maxLength: 2000 } },
  { id: "comentarios", titulo: "Comentários", tipo: "texto", valorDe: (m) => m.comentarios, largura: 280, padrao: false, edicao: { coluna: "comentarios", maxLength: 2000 } },
  { id: "criadoEm", titulo: "Criado em", tipo: "data", valorDe: (m) => m.created_at.slice(0, 10), largura: 150, padrao: false },
];
