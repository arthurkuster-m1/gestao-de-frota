import type { CampoDaTela, OpcaoDoCampo } from "../../components/motor/tipos";
import { ESTADOS_RESERVA, STATUS_EVENTO, TIPOS_EVENTO, type Evento, type Reserva } from "../../lib/eventos/tipos";
import { estaAberta } from "../../lib/eventos/uso";
import type { Veiculo } from "../../lib/veiculos/tipos";

export const OPCOES_STATUS_EVENTO: OpcaoDoCampo[] = STATUS_EVENTO.map((s) => ({ value: s.value, label: s.label, tom: s.tom }));
export const OPCOES_ESTADO_RESERVA: OpcaoDoCampo[] = ESTADOS_RESERVA.map((s) => ({ value: s.value, label: s.label, tom: s.tom }));
const OPCOES_TIPO: OpcaoDoCampo[] = TIPOS_EVENTO.map((t) => ({ value: t, label: t, tom: "neutral" }));

export type ContextoDeEventos = { reservasDoEvento: Map<string, Reserva[]>; veiculos: Map<string, Veiculo>; carregado: boolean };
const codigo = (v: Veiculo | undefined) => (v ? (v.codigo ?? v.modelo.toUpperCase()) : "?");

/** Os campos de evento. Carros, Início e Fim são CALCULADOS das reservas (só leitura); o resto se edita no lugar. */
export const camposDoEvento = (ctx: ContextoDeEventos): CampoDaTela<Evento>[] => {
  const abertas = (e: Evento) => (ctx.reservasDoEvento.get(e.id) ?? []).filter((r) => r.estado !== "cancelado");
  return [
    { id: "nome", titulo: "Evento", tipo: "texto", valorDe: (e) => e.nome, largura: 260, fixa: true, edicao: { coluna: "nome", obrigatorio: true, maxLength: 120 } },
    { id: "tipo", titulo: "Tipo", tipo: "opcao", valorDe: (e) => e.tipo, opcoes: OPCOES_TIPO, rotuloDoValor: (x) => x, largura: 230, edicao: { coluna: "tipo" } },
    { id: "status", titulo: "Status", tipo: "opcao", valorDe: (e) => e.status, opcoes: OPCOES_STATUS_EVENTO, rotuloDoValor: (x) => OPCOES_STATUS_EVENTO.find((o) => o.value === x)?.label ?? x, ordemDoValor: (x) => STATUS_EVENTO.findIndex((s) => s.value === x), largura: 200, edicao: { coluna: "status", obrigatorio: true } },
    { id: "carros", titulo: "Carros", tipo: "texto", valorDe: (e) => { if (!ctx.carregado) return null; const l = abertas(e); return l.length ? `${l.length} · ${l.map((r) => codigo(ctx.veiculos.get(r.veiculo_id))).join(", ")}` : null; }, largura: 360 },
    { id: "inicio", titulo: "Início", tipo: "data", valorDe: (e) => { const l = abertas(e); return l.length ? l.map((r) => r.reserva_inicio).sort()[0]! : null; }, largura: 130 },
    { id: "fim", titulo: "Fim", tipo: "data", valorDe: (e) => { const l = abertas(e); return l.length ? l.map((r) => r.reserva_fim).sort().at(-1)! : null; }, largura: 130 },
    { id: "solicitante", titulo: "Solicitante", tipo: "texto", valorDe: (e) => e.solicitante, largura: 200, edicao: { coluna: "solicitante" } },
    { id: "comentarios", titulo: "Comentários", tipo: "texto", valorDe: (e) => e.comentarios, largura: 280, padrao: false, edicao: { coluna: "comentarios" } },
    { id: "cadastradoEm", titulo: "Criado em", tipo: "data", valorDe: (e) => e.created_at.slice(0, 10), largura: 150, padrao: false },
  ];
};

/** Uma reserva com o carro já resolvido, para editar na janela do evento. */
export type ReservaLinha = Reserva & { codigo: string; conflito: string | null };
export const camposDaReserva: CampoDaTela<ReservaLinha>[] = [
  { id: "codigo", titulo: "Carro", tipo: "texto", valorDe: (r) => r.codigo, largura: 200, fixa: true },
  { id: "inicio", titulo: "Início", tipo: "data", valorDe: (r) => r.reserva_inicio, largura: 170, edicao: { coluna: "reserva_inicio", obrigatorio: true } },
  { id: "fim", titulo: "Fim", tipo: "data", valorDe: (r) => r.reserva_fim, largura: 170, edicao: { coluna: "reserva_fim", obrigatorio: true } },
  { id: "estado", titulo: "Estado", tipo: "opcao", valorDe: (r) => r.estado, opcoes: OPCOES_ESTADO_RESERVA, rotuloDoValor: (x) => OPCOES_ESTADO_RESERVA.find((o) => o.value === x)?.label ?? x, largura: 180, edicao: { coluna: "estado", obrigatorio: true } },
  { id: "comentarios", titulo: "Comentários", tipo: "texto", valorDe: (r) => r.comentarios, largura: 240, edicao: { coluna: "comentarios" } },
];
export { estaAberta };
