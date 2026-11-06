import type { CampoDaTela, OpcaoDoCampo } from "../../components/motor/tipos";
import { divergencias } from "../../lib/contratos/regras";
import { STATUS_ADITIVO, STATUS_CONTRATO, TIPOS_ADITIVO, rotuloTipoAditivo, type Aditivo, type Contrato } from "../../lib/contratos/tipos";
import type { Evento, Reserva } from "../../lib/eventos/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";

const op = (l: readonly { value: string; label: string; tom: OpcaoDoCampo["tom"] }[]): OpcaoDoCampo[] => l.map((x) => ({ value: x.value, label: x.label, tom: x.tom }));
export const OPCOES_STATUS_CONTRATO = op(STATUS_CONTRATO);
export const OPCOES_STATUS_ADITIVO = op(STATUS_ADITIVO);
export const OPCOES_TIPO_ADITIVO = op(TIPOS_ADITIVO);
export const codigoDoCarro = (v: Veiculo | undefined) => (v ? (v.codigo ?? v.modelo.toUpperCase()) : "?");

export type EmVigor = { vigencia: { inicio: string | null; fim: string | null }; carros: Set<string>; aditivos: Aditivo[] };
export type ContextoDeContratos = { eventos: Map<string, Evento>; clientes: Map<string, string>; veiculos: Map<string, Veiculo>; reservasDoEvento: Map<string, Reserva[]>; emVigor: Map<string, EmVigor> };

export const divergenciasDoContrato = (c: Contrato, ctx: ContextoDeContratos) => {
  const ev = ctx.emVigor.get(c.id); if (!ev) return [];
  return divergencias(ev.carros, ev.vigencia, ctx.reservasDoEvento.get(c.evento_id) ?? [], (id) => codigoDoCarro(ctx.veiculos.get(id)));
};

/** Os campos de contrato. Evento, Cliente, Vigência em vigor, Carros, Aditivos e Divergências são CALCULADOS (só leitura). */
export const camposDoContrato = (ctx: ContextoDeContratos): CampoDaTela<Contrato>[] => [
  { id: "evento", titulo: "Evento", tipo: "texto", valorDe: (c) => ctx.eventos.get(c.evento_id)?.nome ?? "?", largura: 240, fixa: true },
  { id: "cliente", titulo: "Cliente", tipo: "texto", valorDe: (c) => ctx.clientes.get(c.cliente_id) ?? "?", largura: 220 },
  { id: "status", titulo: "Status", tipo: "opcao", valorDe: (c) => c.status, opcoes: OPCOES_STATUS_CONTRATO, rotuloDoValor: (x) => OPCOES_STATUS_CONTRATO.find((o) => o.value === x)?.label ?? x, ordemDoValor: (x) => STATUS_CONTRATO.findIndex((s) => s.value === x), largura: 210, edicao: { coluna: "status", obrigatorio: true } },
  { id: "inicio", titulo: "Vigência início", tipo: "data", valorDe: (c) => c.vigencia_inicio, largura: 160, edicao: { coluna: "vigencia_inicio" } },
  { id: "fim", titulo: "Vigência fim (contrato)", tipo: "data", valorDe: (c) => c.vigencia_fim, largura: 190, edicao: { coluna: "vigencia_fim" } },
  { id: "fimEmVigor", titulo: "Fim em vigor", tipo: "data", valorDe: (c) => ctx.emVigor.get(c.id)?.vigencia.fim ?? null, largura: 150 },
  { id: "carros", titulo: "Carros em vigor", tipo: "texto", valorDe: (c) => { const s = ctx.emVigor.get(c.id)?.carros; return s && s.size ? `${s.size} · ${[...s].map((id) => codigoDoCarro(ctx.veiculos.get(id))).join(", ")}` : null; }, largura: 320 },
  { id: "aditivos", titulo: "Aditivos", tipo: "texto", valorDe: (c) => { const a = ctx.emVigor.get(c.id)?.aditivos ?? []; if (!a.length) return null; const ass = a.filter((x) => x.status === "assinado").length; return `${a.length} · ${ass} assinado${ass === 1 ? "" : "s"}`; }, largura: 160 },
  { id: "divergencia", titulo: "Divergência", tipo: "texto", valorDe: (c) => { const d = divergenciasDoContrato(c, ctx); return d.length ? `${d.length} divergência${d.length === 1 ? "" : "s"}` : "Confere"; }, celula: (c) => { const d = divergenciasDoContrato(c, ctx); return d.length ? <span style={{ color: "var(--color-warning-fg)", fontWeight: 600 }}>{d.length} divergência{d.length === 1 ? "" : "s"}</span> : <span className="t-muted">Confere</span>; }, largura: 160 },
  { id: "assinadoEm", titulo: "Assinado em", tipo: "data", valorDe: (c) => c.assinado_em, largura: 150, padrao: false },
  { id: "observacoes", titulo: "Observações", tipo: "texto", valorDe: (c) => c.observacoes, largura: 280, padrao: false, edicao: { coluna: "observacoes", maxLength: 2000 } },
  { id: "criadoEm", titulo: "Criado em", tipo: "data", valorDe: (c) => c.created_at.slice(0, 10), largura: 150, padrao: false },
];

/** Os campos de um aditivo, editáveis no lugar dentro da janela do contrato. */
export const camposDoAditivo: CampoDaTela<Aditivo>[] = [
  { id: "tipo", titulo: "Tipo", tipo: "opcao", valorDe: (a) => a.tipo, opcoes: OPCOES_TIPO_ADITIVO, rotuloDoValor: rotuloTipoAditivo, largura: 170 },
  { id: "status", titulo: "Status", tipo: "opcao", valorDe: (a) => a.status, opcoes: OPCOES_STATUS_ADITIVO, rotuloDoValor: (x) => OPCOES_STATUS_ADITIVO.find((o) => o.value === x)?.label ?? x, largura: 210, edicao: { coluna: "status", obrigatorio: true } },
  { id: "novoFim", titulo: "Novo fim da vigência", tipo: "data", valorDe: (a) => a.vigencia_fim_nova, largura: 170, edicao: { coluna: "vigencia_fim_nova" } },
  { id: "motivo", titulo: "Motivo", tipo: "texto", valorDe: (a) => a.motivo, largura: 260, edicao: { coluna: "motivo", maxLength: 2000 } },
  { id: "assinadoEm", titulo: "Assinado em", tipo: "data", valorDe: (a) => a.assinado_em, largura: 150, edicao: { coluna: "assinado_em" } },
];
