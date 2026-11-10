import { ORIGEM_PADRAO, validarEndereco } from "../../lib/enderecos";
import type { CampoDaTela, OpcaoDoCampo } from "../../components/motor/tipos";
import { ESTADOS_RESERVA, STATUS_EVENTO, TIPOS_EVENTO, UFS, type Evento, type EventoLocal, type Reserva, type ReservaDoEvento } from "../../lib/eventos/tipos";
import { estaAberta } from "../../lib/eventos/uso";
import type { Veiculo } from "../../lib/veiculos/tipos";

export const OPCOES_STATUS_EVENTO: OpcaoDoCampo[] = STATUS_EVENTO.map((s) => ({ value: s.value, label: s.label, tom: s.tom }));
export const OPCOES_ESTADO_RESERVA: OpcaoDoCampo[] = ESTADOS_RESERVA.map((s) => ({ value: s.value, label: s.label, tom: s.tom }));
const OPCOES_TIPO: OpcaoDoCampo[] = TIPOS_EVENTO.map((t) => ({ value: t, label: t, tom: "neutral" }));

export type ContextoDeEventos = {
  /** Carros do evento ainda sem data (contam em "Carros", mas não têm barra nem datas). */ semDataDoEvento?: Map<string, ReservaDoEvento[]>;
  /** Clientes (id → nome) para o campo Cliente do evento. */ clientes?: Map<string, string>; reservasDoEvento: Map<string, Reserva[]>; locaisDoEvento: Map<string, EventoLocal[]>; veiculos: Map<string, Veiculo>; carregado: boolean; valorDoEvento?: Map<string, number> };

/** "Av. Paulista, 1000 — São Paulo/SP" (e o rótulo, se houver). */
export const textoDoLocal = (l: EventoLocal) => [l.rotulo ? `${l.rotulo}:` : null, l.endereco].filter(Boolean).join(" ");
const codigo = (v: Veiculo | undefined) => (v ? (v.codigo ?? v.modelo.toUpperCase()) : "?");

/** Os campos de evento. Carros, Início e Fim são CALCULADOS das reservas (só leitura); o resto se edita no lugar. */
export const camposDoEvento = (ctx: ContextoDeEventos): CampoDaTela<Evento>[] => {
  const abertas = (e: Evento) => (ctx.reservasDoEvento.get(e.id) ?? []).filter((r) => r.estado !== "cancelado");
  return [
    { id: "nome", titulo: "Evento", tipo: "texto", valorDe: (e) => e.nome, largura: 260, fixa: true, edicao: { coluna: "nome", obrigatorio: true, maxLength: 120 } },
    { id: "cliente", titulo: "Cliente", tipo: "opcao", valorDe: (e) => e.cliente_id ?? null, opcoes: [...(ctx.clientes ?? new Map<string, string>())].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")).map(([value, label]) => ({ value, label })),
      rotuloDoValor: (x) => ctx.clientes?.get(x) ?? x, largura: 240, edicao: { coluna: "cliente_id" } },
    { id: "tipo", titulo: "Tipo", tipo: "opcao", valorDe: (e) => e.tipo, opcoes: OPCOES_TIPO, rotuloDoValor: (x) => x, largura: 230, edicao: { coluna: "tipo" } },
    { id: "status", titulo: "Status", tipo: "opcao", valorDe: (e) => e.status, opcoes: OPCOES_STATUS_EVENTO, rotuloDoValor: (x) => OPCOES_STATUS_EVENTO.find((o) => o.value === x)?.label ?? x, ordemDoValor: (x) => STATUS_EVENTO.findIndex((s) => s.value === x), largura: 200, edicao: { coluna: "status", obrigatorio: true } },
    { id: "carros", titulo: "Carros", tipo: "texto", valorDe: (e) => { if (!ctx.carregado) return null; const l = [...abertas(e), ...(ctx.semDataDoEvento?.get(e.id) ?? []).filter((r) => r.estado !== "cancelado")]; return l.length ? `${l.length} · ${l.map((r) => codigo(ctx.veiculos.get(r.veiculo_id))).join(", ")}` : null; }, largura: 360 },
    { id: "locais", titulo: "Locais", tipo: "texto", valorDe: (e) => { const l = ctx.locaisDoEvento.get(e.id) ?? []; return l.length ? `${textoDoLocal(l[0]!)}${l.length > 1 ? ` (+${l.length - 1})` : ""}` : null; }, largura: 380 },
    { id: "transporte", titulo: "Transporte (R$)", tipo: "numero", valorDe: (e) => ctx.valorDoEvento?.get(e.id) ?? null, celula: (e) => { const v = ctx.valorDoEvento?.get(e.id); return v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : <span className="mt-vazio">—</span>; }, largura: 170, padrao: false },
    { id: "envio", titulo: "Data de envio", tipo: "data", valorDe: (e) => e.envio_previsto ?? null, largura: 150, padrao: false, edicao: { coluna: "envio_previsto" } },
    { id: "inicio", titulo: "Data de chegada", tipo: "data", valorDe: (e) => { const l = abertas(e); return l.length ? l.map((r) => r.reserva_inicio).sort()[0]! : e.chegada_prevista; }, largura: 150, edicao: { coluna: "chegada_prevista" } },
    { id: "fim", titulo: "Data de retirada", tipo: "data", valorDe: (e) => { const l = abertas(e); return l.length ? l.map((r) => r.reserva_fim).sort().at(-1)! : e.retirada_prevista; }, largura: 150, edicao: { coluna: "retirada_prevista" } },
    { id: "retorno", titulo: "Data de retorno", tipo: "data", valorDe: (e) => e.retorno_previsto ?? null, largura: 150, padrao: false, edicao: { coluna: "retorno_previsto" } },
    { id: "distIda", titulo: "Distância de ida (km)", tipo: "numero", valorDe: (e) => e.distancia_ida_km ?? null, largura: 160, padrao: false, edicao: { coluna: "distancia_ida_km" } },
    { id: "distVolta", titulo: "Distância de volta (km)", tipo: "numero", valorDe: (e) => e.distancia_volta_km ?? null, largura: 170, padrao: false, edicao: { coluna: "distancia_volta_km" } },
    { id: "solicitante", titulo: "Solicitante", tipo: "texto", valorDe: (e) => e.solicitante, largura: 200, edicao: { coluna: "solicitante" } },
    { id: "origem", titulo: "Origem", tipo: "texto", valorDe: (e) => e.origem ?? null, largura: 320, padrao: false, edicao: { coluna: "origem", maxLength: 300, endereco: true, validar: validarEndereco, sugestaoDeEndereco: ORIGEM_PADRAO } },
    { id: "contato", titulo: "Contato", tipo: "texto", valorDe: (e) => e.contato, largura: 220, edicao: { coluna: "contato" } },
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
  { id: "chegada", titulo: "Chegada", tipo: "data", valorDe: (r) => r.chegada, largura: 170, edicao: { coluna: "chegada" } },
  { id: "retirada", titulo: "Retirada", tipo: "data", valorDe: (r) => r.retirada, largura: 170, edicao: { coluna: "retirada" } },
  { id: "estado", titulo: "Estado", tipo: "opcao", valorDe: (r) => r.estado, opcoes: OPCOES_ESTADO_RESERVA, rotuloDoValor: (x) => OPCOES_ESTADO_RESERVA.find((o) => o.value === x)?.label ?? x, largura: 180, edicao: { coluna: "estado", obrigatorio: true } },
  { id: "comentarios", titulo: "Comentários", tipo: "texto", valorDe: (r) => r.comentarios, largura: 240, edicao: { coluna: "comentarios" } },
];
export { estaAberta };

const OPCOES_UF: OpcaoDoCampo[] = UFS.map((u) => ({ value: u, label: u, tom: "neutral" }));
/** Os campos de um local do evento (todos editáveis no lugar; o endereço é obrigatório). */
export const camposDoLocal: CampoDaTela<EventoLocal>[] = [
  { id: "rotulo", titulo: "Nome do local", tipo: "texto", valorDe: (l) => l.rotulo, largura: 200, edicao: { coluna: "rotulo", maxLength: 80 } },
  { id: "endereco", titulo: "Endereço", tipo: "texto", valorDe: (l) => l.endereco, largura: 360, edicao: { coluna: "endereco", obrigatorio: true, maxLength: 300, endereco: true, validar: validarEndereco } },
];
