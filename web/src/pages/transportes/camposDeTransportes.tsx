import type { CampoDaTela, OpcaoDoCampo } from "../../components/motor/tipos";
import type { Evento, Reserva } from "../../lib/eventos/tipos";
import { reais, reservasDoTransporte } from "../../lib/transportes/regras";
import { nomeCurtoDoLugar } from "../../lib/transportes/rota";
import { MODALIDADES, SENTIDOS, TODOS_STATUS_PAGAMENTO, type Transporte, type VinculoDaReserva } from "../../lib/transportes/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";

const op = (l: readonly { value: string; label: string; tom: OpcaoDoCampo["tom"] }[]): OpcaoDoCampo[] => l.map((x) => ({ value: x.value, label: x.label, tom: x.tom }));
export const OPCOES_SENTIDO = op(SENTIDOS);
export const OPCOES_MODALIDADE = op(MODALIDADES);
export const OPCOES_STATUS_PAGAMENTO = op(TODOS_STATUS_PAGAMENTO);
const rotulo = (o: OpcaoDoCampo[], x: string) => o.find((y) => y.value === x)?.label ?? x;
const dinheiro = (n: number | null) => (n === null || n === undefined ? <span className="mt-vazio">—</span> : reais(n));

export type ContextoDeTransportes = {
  eventos: Map<string, Evento>; veiculos: Map<string, Veiculo>; reservas: Reserva[]; vinculos: VinculoDaReserva[]; transportes: Transporte[];
};
const codigo = (v: Veiculo | undefined) => (v ? (v.codigo ?? v.modelo.toUpperCase()) : "?");

/** Os campos de transporte (rota e pagamento dentro). Evento, Origem, Destino e Carros vêm do evento (só leitura); o resto se edita no lugar. */
export const camposDoTransporte = (ctx: ContextoDeTransportes): CampoDaTela<Transporte>[] => {
  const carros = (t: Transporte) => reservasDoTransporte(t, ctx.vinculos).map((id) => ctx.reservas.find((r) => r.id === id)).filter((r): r is Reserva => !!r).map((r) => codigo(ctx.veiculos.get(r.veiculo_id)));
  return [
    { id: "referencia", titulo: "Referência", tipo: "texto", valorDe: (t) => t.referencia, largura: 190, fixa: true, edicao: { coluna: "referencia", maxLength: 60, placeholder: "PTAS00666314" } },
    { id: "evento", titulo: "Evento", tipo: "texto", valorDe: (t) => ctx.eventos.get(t.evento_id)?.nome ?? "?", largura: 220 },
    { id: "sentido", titulo: "Sentido", tipo: "opcao", valorDe: (t) => t.sentido, opcoes: OPCOES_SENTIDO, rotuloDoValor: (x) => rotulo(OPCOES_SENTIDO, x), largura: 120, edicao: { coluna: "sentido", obrigatorio: true } },
    { id: "modalidade", titulo: "Modalidade", tipo: "opcao", valorDe: (t) => t.modalidade, opcoes: OPCOES_MODALIDADE, rotuloDoValor: (x) => rotulo(OPCOES_MODALIDADE, x), largura: 160, edicao: { coluna: "modalidade", obrigatorio: true } },
    { id: "origem", titulo: "Origem", tipo: "texto", valorDe: (t) => t.origem, celula: (t) => (t.origem ? <span title={t.origem}>{nomeCurtoDoLugar(t.origem)}</span> : <span className="mt-vazio">—</span>), largura: 200 },
    { id: "destino", titulo: "Destino", tipo: "texto", valorDe: (t) => t.destino, celula: (t) => (t.destino ? <span title={t.destino}>{nomeCurtoDoLugar(t.destino)}</span> : <span className="mt-vazio">—</span>), largura: 200 },
    { id: "carros", titulo: "Carros", tipo: "texto", valorDe: (t) => { const c = carros(t); return c.length ? `${c.length} · ${c.join(", ")}` : null; }, largura: 300 },
    { id: "distancia", titulo: "Distância aprox. (km)", tipo: "numero", valorDe: (t) => t.distancia_km, largura: 150, edicao: { coluna: "distancia_km", placeholder: "3000" } },
    { id: "dias", titulo: "Dias de viagem", tipo: "numero", valorDe: (t) => t.dias_viagem, largura: 150, edicao: { coluna: "dias_viagem", obrigatorio: true } },
    { id: "transportadora", titulo: "Transportadora", tipo: "texto", valorDe: (t) => t.transportadora, largura: 180, edicao: { coluna: "transportadora", maxLength: 80 } },
    { id: "valor", titulo: "Valor planejado", tipo: "numero", valorDe: (t) => t.valor_planejado, celula: (t) => dinheiro(t.valor_planejado), largura: 160, edicao: { coluna: "valor_planejado", placeholder: "1500,00" } },
    { id: "statusPagamento", titulo: "Status do pagamento", tipo: "opcao", valorDe: (t) => t.status_pagamento, opcoes: OPCOES_STATUS_PAGAMENTO, rotuloDoValor: (x) => rotulo(OPCOES_STATUS_PAGAMENTO, x), ordemDoValor: (x) => TODOS_STATUS_PAGAMENTO.findIndex((s) => s.value === x), largura: 200, edicao: { coluna: "status_pagamento" } },
    { id: "valorReal", titulo: "Valor real", tipo: "numero", valorDe: (t) => t.valor_real, celula: (t) => dinheiro(t.valor_real), largura: 140, edicao: { coluna: "valor_real", placeholder: "1500,00" } },
    { id: "pagoEm", titulo: "Pago em", tipo: "data", valorDe: (t) => t.data_pagamento, largura: 140, edicao: { coluna: "data_pagamento" } },
    { id: "departamento", titulo: "Departamento", tipo: "texto", valorDe: (t) => t.departamento, largura: 180, padrao: false, edicao: { coluna: "departamento", maxLength: 80 } },
    { id: "comentarios", titulo: "Comentários", tipo: "texto", valorDe: (t) => t.comentarios, largura: 260, padrao: false, edicao: { coluna: "comentarios", maxLength: 2000 } },
    { id: "criadoEm", titulo: "Criado em", tipo: "data", valorDe: (t) => t.created_at.slice(0, 10), largura: 150, padrao: false },
  ];
};
