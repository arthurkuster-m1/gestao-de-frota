import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, Segmented } from "../../ds";
import { LinkNoLugar } from "../../app/noLugar";
import { hojeLocal } from "../../lib/motor/datas";
import { previsaoFinanceira, type SituacaoFinanceira } from "../../lib/transportes/previsao";
import { reais } from "../../lib/transportes/regras";
import { rotuloStatusPagamento } from "../../lib/transportes/tipos";
import type { useDadosDeEventos } from "../eventos/useDadosDeEventos";

type Filtro = "previsao" | SituacaoFinanceira | "todos";
const ROTULO: Record<SituacaoFinanceira, string> = { aprovado: "Aprovado", executado: "Executado, aguardando aprovação", a_executar: "A executar" };

/** Planejamento › Financeiro: quanto se espera pagar no próximo mês, a partir dos transportes que já aconteceram e das PTAs/NFs aprovadas. */
export function PainelFinanceiro({ d }: { d: ReturnType<typeof useDadosDeEventos> }) {
  const [filtro, setFiltro] = useState<Filtro>("previsao");
  const p = useMemo(() => previsaoFinanceira({ transportes: d.tr.transportes, vinculos: d.tr.vinculos, reservas: [...d.reservas, ...d.reservasSemData], checklists: d.ck.checklists }), [d.tr.transportes, d.tr.vinculos, d.reservas, d.reservasSemData, d.ck.checklists]);
  const eventos = useMemo(() => new Map((d.eventos ?? []).map((e) => [e.id, e.nome])), [d.eventos]);
  const proximoMes = useMemo(() => { const [a, m] = hojeLocal().split("-").map(Number); return new Date(a!, m!, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); }, []);
  const pronto = d.eventos !== null && d.tr.carregado && d.ck.carregado;

  const itens = p.itens.filter((i) => (filtro === "todos" ? true : filtro === "previsao" ? i.situacao !== "a_executar" : i.situacao === filtro))
    .sort((a, b) => (eventos.get(a.transporte.evento_id) ?? "").localeCompare(eventos.get(b.transporte.evento_id) ?? "", "pt-BR") || b.valor - a.valor);
  const porEvento = new Map<string, number>();
  for (const i of p.itens) if (i.situacao !== "a_executar") porEvento.set(i.transporte.evento_id, (porEvento.get(i.transporte.evento_id) ?? 0) + i.valor);
  const topo = [...porEvento].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maior = topo[0]?.[1] ?? 0;
  const card = (rotulo: string, valor: number, dica: string, destaque = false, testid?: string) => (
    <div className={destaque ? "plan-fin__card is-destaque" : "plan-fin__card"} data-testid={testid}><span className="t-body-sm t-muted">{rotulo}</span><b>{reais(valor)}</b><span className="t-body-sm t-muted">{dica}</span></div>
  );

  return (
    <section className="ds-stack" aria-label="Financeiro" data-testid="painel-financeiro">
      <div>
        <h2 className="t-h3">Previsão de pagamento · {proximoMes}</h2>
        <p className="t-body-sm t-muted">Soma dos transportes ainda não pagos que já foram executados e das PTAs e notas já aprovadas (valor real, ou o planejado se ainda não houver). Retirada não entra: não tem pagamento.</p>
      </div>
      {!pronto ? <Card><p className="t-body t-muted">Carregando…</p></Card> : (
        <>
          <div className="plan-fin__cards">
            {card("Previsão do próximo mês", p.previsao, `${p.itens.filter((i) => i.situacao !== "a_executar").length} transporte(s) a pagar`, true, "fin-previsao")}
            {card("Aprovados", p.aprovados, "PTA/NF aprovada, pronta para pagar", false, "fin-aprovados")}
            {card("Executados", p.executados, "Já aconteceram, falta aprovar", false, "fin-executados")}
            {card("A executar", p.aExecutar, "Ainda não aconteceram (fora da previsão)", false, "fin-a-executar")}
          </div>
          {p.semValor > 0 && <p className="t-body-sm" role="status" style={{ color: "var(--color-warning-fg)" }}>{p.semValor} transporte{p.semValor === 1 ? "" : "s"} da previsão está{p.semValor === 1 ? "" : "m"} sem valor cadastrado (conta como R$ 0,00).</p>}

          {topo.length > 0 && (
            <Card>
              <h3 className="t-h3" style={{ marginBottom: 8 }}>Onde está o maior valor</h3>
              <ul className="plan-fin__barras" role="list" data-testid="fin-por-evento">
                {topo.map(([id, v]) => <li key={id}><LinkNoLugar to={`/eventos/${id}`} className="mt-reserva__evento">{eventos.get(id) ?? "?"}</LinkNoLugar><span className="plan-fin__trilho"><span style={{ width: `${maior ? Math.max(4, (v / maior) * 100) : 0}%` }} /></span><b>{reais(v)}</b></li>)}
              </ul>
            </Card>
          )}

          <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <h3 className="t-h3">Transportes</h3>
            <Segmented options={[{ value: "previsao", label: "Na previsão" }, { value: "aprovado", label: "Aprovados" }, { value: "executado", label: "Executados" }, { value: "a_executar", label: "A executar" }, { value: "todos", label: "Todos" }]} value={filtro} onChange={(v: Filtro) => setFiltro(v)} />
          </div>
          {itens.length === 0 ? <p className="t-body t-muted">Nada neste filtro.</p> : (
            <div className="mt-vde__rolar" style={{ maxHeight: "none" }}>
              <table className="mt-vde__tabela plan-fin__tabela" data-testid="fin-tabela">
                <thead><tr><th>Evento</th><th>Transporte</th><th>Situação</th><th>Status do pagamento</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
                <tbody>
                  {itens.map((i) => (
                    <tr key={i.transporte.id} data-testid="fin-linha">
                      <td><LinkNoLugar to={`/eventos/${i.transporte.evento_id}`} className="mt-reserva__evento">{eventos.get(i.transporte.evento_id) ?? "?"}</LinkNoLugar></td>
                      <td><Link to={`/transportes/${i.transporte.id}`} className="mt-reserva__evento">{i.transporte.sentido === "ida" ? "Ida" : "Volta"} · {(i.transporte.modalidade ?? "").toUpperCase()}{i.transporte.referencia ? ` ${i.transporte.referencia}` : ""}</Link></td>
                      <td>{ROTULO[i.situacao]}</td>
                      <td>{i.transporte.status_pagamento ? rotuloStatusPagamento(i.transporte.status_pagamento) : "—"}</td>
                      <td style={{ textAlign: "right" }}>{i.semValor ? <span className="mt-vazio">sem valor</span> : reais(i.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
