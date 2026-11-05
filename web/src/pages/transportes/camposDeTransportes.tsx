import type { CampoDaTela, OpcaoDoCampo } from "../../components/motor/tipos";
import type { Evento, Reserva } from "../../lib/eventos/tipos";
import { reais, reservasDoTransporte } from "../../lib/transportes/regras";
import { MODALIDADES, SENTIDOS, TIPOS_PAGAMENTO, TODOS_STATUS_PAGAMENTO, type Pagamento, type Transporte, type VinculoDaReserva } from "../../lib/transportes/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";

const op = (l: readonly { value: string; label: string; tom: OpcaoDoCampo["tom"] }[]): OpcaoDoCampo[] => l.map((x) => ({ value: x.value, label: x.label, tom: x.tom }));
export const OPCOES_SENTIDO = op(SENTIDOS);
export const OPCOES_MODALIDADE = op(MODALIDADES);
export const OPCOES_TIPO_PAGAMENTO = op(TIPOS_PAGAMENTO);
export const OPCOES_STATUS_PAGAMENTO = op(TODOS_STATUS_PAGAMENTO);
const rotulo = (o: OpcaoDoCampo[], x: string) => o.find((y) => y.value === x)?.label ?? x;
const dinheiro = (n: number | null) => (n === null || n === undefined ? <span className="mt-vazio">—</span> : reais(n));
export const nomeDoPagamento = (p: Pagamento) => `${p.tipo === "pta" ? "PTA" : "NF"} ${p.numero}`;

export type ContextoDeTransportes = {
  eventos: Map<string, Evento>; veiculos: Map<string, Veiculo>; reservas: Reserva[]; vinculos: VinculoDaReserva[]; pagamentos: Pagamento[]; transportes: Transporte[];
};
const codigo = (v: Veiculo | undefined) => (v ? (v.codigo ?? v.modelo.toUpperCase()) : "?");

/** Os campos de transporte. Evento, Carros e a situação do pagamento são CALCULADOS (só leitura); o resto se edita no lugar. */
export const camposDoTransporte = (ctx: ContextoDeTransportes): CampoDaTela<Transporte>[] => {
  const pag = new Map(ctx.pagamentos.map((p) => [p.id, p]));
  const carros = (t: Transporte) => reservasDoTransporte(t, ctx.vinculos).map((id) => ctx.reservas.find((r) => r.id === id)).filter((r): r is Reserva => !!r).map((r) => codigo(ctx.veiculos.get(r.veiculo_id)));
  return [
    { id: "referencia", titulo: "Referência", tipo: "texto", valorDe: (t) => t.referencia, largura: 190, fixa: true, edicao: { coluna: "referencia", maxLength: 60, placeholder: "PTAS00666314" } },
    { id: "evento", titulo: "Evento", tipo: "texto", valorDe: (t) => ctx.eventos.get(t.evento_id)?.nome ?? "?", largura: 220 },
    { id: "sentido", titulo: "Sentido", tipo: "opcao", valorDe: (t) => t.sentido, opcoes: OPCOES_SENTIDO, rotuloDoValor: (x) => rotulo(OPCOES_SENTIDO, x), largura: 120, edicao: { coluna: "sentido", obrigatorio: true } },
    { id: "modalidade", titulo: "Modalidade", tipo: "opcao", valorDe: (t) => t.modalidade, opcoes: OPCOES_MODALIDADE, rotuloDoValor: (x) => rotulo(OPCOES_MODALIDADE, x), largura: 160, edicao: { coluna: "modalidade", obrigatorio: true } },
    { id: "carros", titulo: "Carros", tipo: "texto", valorDe: (t) => { const c = carros(t); return c.length ? `${c.length} · ${c.join(", ")}` : null; }, largura: 300 },
    { id: "distancia", titulo: "Distância (km)", tipo: "numero", valorDe: (t) => t.distancia_km, largura: 150, edicao: { coluna: "distancia_km", placeholder: "3000" } },
    { id: "dias", titulo: "Dias de viagem", tipo: "numero", valorDe: (t) => t.dias_viagem, largura: 150, edicao: { coluna: "dias_viagem", obrigatorio: true } },
    { id: "transportadora", titulo: "Transportadora", tipo: "texto", valorDe: (t) => t.transportadora, largura: 180, edicao: { coluna: "transportadora", maxLength: 80 } },
    { id: "valor", titulo: "Valor planejado", tipo: "numero", valorDe: (t) => t.valor_planejado, celula: (t) => dinheiro(t.valor_planejado), largura: 160, edicao: { coluna: "valor_planejado", placeholder: "1500,00" } },
    { id: "pagamento", titulo: "Pagamento", tipo: "opcao", valorDe: (t) => t.pagamento_id, opcoes: ctx.pagamentos.map((p) => ({ value: p.id, label: nomeDoPagamento(p), tom: "neutral" as const })), rotuloDoValor: (x) => { const p = pag.get(x); return p ? nomeDoPagamento(p) : x; }, largura: 200, edicao: { coluna: "pagamento_id" } },
    { id: "situacao", titulo: "Situação do pagamento", tipo: "texto", valorDe: (t) => { const p = t.pagamento_id ? pag.get(t.pagamento_id) : null; return p ? rotulo(OPCOES_STATUS_PAGAMENTO, p.status) : null; }, largura: 190 },
    { id: "comentarios", titulo: "Comentários", tipo: "texto", valorDe: (t) => t.comentarios, largura: 260, padrao: false, edicao: { coluna: "comentarios", maxLength: 2000 } },
    { id: "criadoEm", titulo: "Criado em", tipo: "data", valorDe: (t) => t.created_at.slice(0, 10), largura: 150, padrao: false },
  ];
};

/** Os campos de pagamento. Tipo, Transportes e Valor dos transportes são calculados; o resto se edita no lugar. */
export const camposDoPagamento = (ctx: ContextoDeTransportes): CampoDaTela<Pagamento>[] => {
  const dele = (p: Pagamento) => ctx.transportes.filter((t) => t.pagamento_id === p.id);
  return [
    { id: "numero", titulo: "Número", tipo: "texto", valorDe: (p) => p.numero, largura: 190, fixa: true, edicao: { coluna: "numero", obrigatorio: true, maxLength: 60 } },
    { id: "tipo", titulo: "Tipo", tipo: "opcao", valorDe: (p) => p.tipo, opcoes: OPCOES_TIPO_PAGAMENTO, rotuloDoValor: (x) => rotulo(OPCOES_TIPO_PAGAMENTO, x), largura: 130 },
    { id: "status", titulo: "Status", tipo: "opcao", valorDe: (p) => p.status, opcoes: OPCOES_STATUS_PAGAMENTO, rotuloDoValor: (x) => rotulo(OPCOES_STATUS_PAGAMENTO, x), ordemDoValor: (x) => TODOS_STATUS_PAGAMENTO.findIndex((s) => s.value === x), largura: 190, edicao: { coluna: "status", obrigatorio: true } },
    { id: "transportes", titulo: "Transportes", tipo: "texto", valorDe: (p) => { const l = dele(p); return l.length ? `${l.length} · ${l.map((t) => `${ctx.eventos.get(t.evento_id)?.nome ?? "?"} (${t.sentido})`).join(", ")}` : null; }, largura: 320 },
    { id: "planejado", titulo: "Valor planejado", tipo: "numero", valorDe: (p) => p.valor_planejado, celula: (p) => dinheiro(p.valor_planejado), largura: 160, edicao: { coluna: "valor_planejado", placeholder: "1500,00" } },
    { id: "real", titulo: "Valor real", tipo: "numero", valorDe: (p) => p.valor_real, celula: (p) => dinheiro(p.valor_real), largura: 140, edicao: { coluna: "valor_real", placeholder: "1500,00" } },
    { id: "dosTransportes", titulo: "Soma dos transportes", tipo: "numero", valorDe: (p) => { const s = dele(p).reduce((a, t) => a + (t.valor_planejado ?? 0), 0); return s || null; }, celula: (p) => { const s = dele(p).reduce((a, t) => a + (t.valor_planejado ?? 0), 0); return dinheiro(s || null); }, largura: 190, padrao: false },
    { id: "pagoEm", titulo: "Pago em", tipo: "data", valorDe: (p) => p.data_pagamento, largura: 140, edicao: { coluna: "data_pagamento" } },
    { id: "departamento", titulo: "Departamento", tipo: "texto", valorDe: (p) => p.departamento, largura: 180, edicao: { coluna: "departamento", maxLength: 80 } },
    { id: "comentarios", titulo: "Comentários", tipo: "texto", valorDe: (p) => p.comentarios, largura: 260, padrao: false, edicao: { coluna: "comentarios", maxLength: 2000 } },
    { id: "criadoEm", titulo: "Criado em", tipo: "data", valorDe: (p) => p.created_at.slice(0, 10), largura: 150, padrao: false },
  ];
};
