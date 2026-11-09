import { useMemo, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Segmented, cx } from "../../ds";
import { LinkNoLugar } from "../../app/noLugar";
import { empilhar, totalDeFaixas } from "../../lib/linhaDoTempo/faixas";
import { gerarDias, larguraDoPeriodo, nomeDoMes, posicaoDoDia } from "../../lib/linhaDoTempo/eixo";
import type { Barra } from "../../lib/linhaDoTempo/tipos";
import { diaDaSemanaDaChave, diferencaEmDias, hojeLocal, somarDias } from "../../lib/motor/datas";

/** Um compromisso do carro (evento ou manutenção) com data, e para onde ele leva ao clicar. */
export type ItemDaAgenda = Barra & { href: string };

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const LARGURA = 30, ALTURA_FAIXA = 26;
const domingo = (c: string) => somarDias(c, -((diaDaSemanaDaChave(c) + 1) % 7));

/** A agenda do carro em duas visões: calendário (mês) ou linha do tempo (dias em fila). */
export function AgendaDoCarro({ itens }: { itens: readonly ItemDaAgenda[] }) {
  const hoje = hojeLocal();
  const [modo, setModo] = useState<"calendario" | "timeline">("calendario");
  const [mes, setMes] = useState(`${hoje.slice(0, 7)}-01`);

  return (
    <div className="ds-stack" data-testid="agenda-do-carro">
      <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <Segmented options={[{ value: "calendario", label: "Calendário" }, { value: "timeline", label: "Linha do tempo" }]} value={modo} onChange={(v) => setModo(v as "calendario" | "timeline")} />
        {modo === "calendario" && (
          <div className="ds-row" style={{ gap: 6 }}>
            <button type="button" className="mt-btn mt-btn--icone" aria-label="Mês anterior" onClick={() => setMes(somarDias(mes, -1).slice(0, 7) + "-01")}><CaretLeft size={16} weight="bold" /></button>
            <b className="mt-cal__mes" data-testid="mes-da-agenda">{nomeDoMes(mes.slice(0, 7))}</b>
            <button type="button" className="mt-btn mt-btn--icone" aria-label="Próximo mês" onClick={() => setMes(somarDias(mes, 32).slice(0, 7) + "-01")}><CaretRight size={16} weight="bold" /></button>
            <button type="button" className="mt-btn" onClick={() => setMes(`${hoje.slice(0, 7)}-01`)}>Hoje</button>
          </div>
        )}
      </div>
      {modo === "calendario" ? <Calendario itens={itens} mes={mes} hoje={hoje} /> : <Linha itens={itens} hoje={hoje} />}
    </div>
  );
}

function Calendario({ itens, mes, hoje }: { itens: readonly ItemDaAgenda[]; mes: string; hoje: string }) {
  const dias = useMemo(() => { const ini = domingo(mes); return Array.from({ length: 42 }, (_, i) => somarDias(ini, i)); }, [mes]);
  const doDia = (d: string) => itens.filter((x) => x.inicio <= d && d <= x.fim);
  return (
    <div className="mt-cal" role="grid" aria-label="Calendário do carro">
      {DIAS.map((d) => <div key={d} className="mt-cal__cab" role="columnheader">{d}</div>)}
      {dias.map((d) => {
        const lista = doDia(d), fora = d.slice(0, 7) !== mes.slice(0, 7);
        return (
          <div key={d} className={cx("mt-cal__dia", fora && "is-fora", d === hoje && "is-hoje")} role="gridcell" data-dia={d}>
            <span className="mt-cal__num">{Number(d.slice(8, 10))}</span>
            {lista.slice(0, 3).map((x) => <LinkNoLugar key={x.id} to={x.href} className={`mt-cal__chip mt-cal__chip--${x.tom}`} title={`${x.rotulo} (${x.inicio.split("-").reverse().join("/")} a ${x.fim.split("-").reverse().join("/")})`}>{x.rotulo}</LinkNoLugar>)}
            {lista.length > 3 && <span className="mt-cal__mais">+{lista.length - 3}</span>}
          </div>
        );
      })}
    </div>
  );
}

function Linha({ itens, hoje }: { itens: readonly ItemDaAgenda[]; hoje: string }) {
  const { origem, total, empilhadas, faixas } = useMemo(() => {
    const ini = [hoje, ...itens.map((x) => x.inicio)].sort()[0]!, fim = [hoje, ...itens.map((x) => x.fim)].sort().at(-1)!;
    const origem = domingo(somarDias(ini, -14)); const total = Math.max(120, diferencaEmDias(origem, somarDias(fim, 45)) + 1);
    const empilhadas = empilhar(itens);
    return { origem, total, empilhadas, faixas: totalDeFaixas(empilhadas) };
  }, [itens, hoje]);
  const dias = useMemo(() => gerarDias(origem, total), [origem, total]);
  return (
    <div className="mt-agtl" data-testid="timeline-do-carro">
      <div className="mt-agtl__grade" style={{ width: total * LARGURA }}>
        <div className="mt-agtl__dias">
          {dias.map((d) => <div key={d} className={cx("mt-agtl__dia", d === hoje && "is-hoje", d.endsWith("-01") && "is-mes")} style={{ width: LARGURA }} title={d}>
            {d.endsWith("-01") || d === origem ? <span className="mt-agtl__nome">{nomeDoMes(d.slice(0, 7))}</span> : null}<b>{Number(d.slice(8, 10))}</b></div>)}
        </div>
        <div className="mt-agtl__corpo" style={{ height: Math.max(1, faixas) * ALTURA_FAIXA + 12 }}>
          <span className="mt-agtl__hoje" style={{ left: posicaoDoDia(hoje, origem, LARGURA) + LARGURA / 2 }} aria-hidden />
          {empilhadas.map(({ barra, faixa }) => (
            <LinkNoLugar key={barra.id} to={barra.href} className={`mt-agtl__barra mt-cal__chip--${barra.tom}`} title={`${barra.rotulo} (${barra.inicio.split("-").reverse().join("/")} a ${barra.fim.split("-").reverse().join("/")})`}
              style={{ left: posicaoDoDia(barra.inicio, origem, LARGURA), width: Math.max(larguraDoPeriodo(barra.inicio, barra.fim, LARGURA), 14), top: 6 + faixa * ALTURA_FAIXA, height: ALTURA_FAIXA - 4 }}>{barra.rotulo}</LinkNoLugar>
          ))}
        </div>
      </div>
    </div>
  );
}
