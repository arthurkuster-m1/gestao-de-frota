import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle, MapPin, Phone, User, Warning } from "@phosphor-icons/react";
import { Button, Card, Page, Segmented, Select } from "../../ds";
import { LinkNoLugar } from "../../app/noLugar";
import { Tag } from "../../components/motor/Tag";
import { quandoFoi, reservasParaChecklist } from "../../lib/checklists/regras";
import { rotuloMomento, type Momento } from "../../lib/checklists/tipos";
import { hojeLocal, formatarDiaBr } from "../../lib/motor/datas";
import { ESTADOS_RESERVA, STATUS_EVENTO, type Evento, type ReservaDoEvento } from "../../lib/eventos/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { useDadosDeEventos } from "../eventos/useDadosDeEventos";
import { BuscaDeVeiculo } from "./BuscaDeVeiculo";
import { ChecklistRapido } from "./ChecklistRapido";
import { HistoricoDeChecklists } from "./HistoricoDeChecklists";
import "../veiculos/veiculos.css";

const ROTULO: Record<Momento, string> = { saida: "Envio para o evento", retorno: "Retorno do evento" };

/**
 * Checklists: a página do dia a dia. Escolha envio ou retorno, digite a placa (a busca mostra modelo e cor para conferir), e o evento do carro
 * já vem escolhido (o que acontece hoje), com quem estamos entregando. Data e hora vêm de agora. Salvou, passa para o próximo carro.
 */
export function ChecklistsPagina() {
  const d = useDadosDeEventos();
  const hoje = hojeLocal();
  const [aba, setAba] = useState<Momento | "historico">("saida");
  const momento: Momento = aba === "historico" ? "saida" : aba;
  const noHistorico = aba === "historico";
  const [carro, setCarro] = useState<Veiculo | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  const reservasDoCarro = useMemo<ReservaDoEvento[]>(() => (carro ? [...d.reservas, ...d.reservasSemData].filter((r) => r.veiculo_id === carro.id) : []), [carro, d.reservas, d.reservasSemData]);
  const candidatas = useMemo(() => reservasParaChecklist(reservasDoCarro, d.ck.checklists, momento, hoje), [reservasDoCarro, d.ck.checklists, momento, hoje]);
  const reserva = candidatas.find((r) => r.id === escolhida) ?? candidatas[0] ?? null;
  const evento = reserva ? (d.eventos?.find((e) => e.id === reserva.evento_id) ?? null) : null;
  const jaFeito = reserva ? d.ck.checklists.find((c) => c.reserva_id === reserva.id && c.momento === momento) ?? null : null;
  const cliente = evento?.cliente_id ? (d.clientes.find((c) => c.id === evento.cliente_id)?.nome ?? null) : null;
  const local = evento ? d.locais.filter((l) => l.evento_id === evento.id).sort((a, b) => a.posicao - b.posicao)[0] ?? null : null;
  const recentes = useMemo(() => [...d.ck.checklists].sort((a, b) => b.data_hora.localeCompare(a.data_hora)).slice(0, 8), [d.ck.checklists]);
  const nomeDoCarro = (reservaId: string) => { const r = [...d.reservas, ...d.reservasSemData].find((x) => x.id === reservaId); const v = r && d.veiculos.find((x) => x.id === r.veiculo_id); return v ? (v.codigo ?? v.modelo.toUpperCase()) : "?"; };
  const eventoDe = (reservaId: string) => { const r = [...d.reservas, ...d.reservasSemData].find((x) => x.id === reservaId); return r ? (d.eventos?.find((e) => e.id === r.evento_id)?.nome ?? "?") : "?"; };

  const carroDaReserva = (reservaId: string) => { const r = [...d.reservas, ...d.reservasSemData].find((x) => x.id === reservaId); const v = r && d.veiculos.find((x) => x.id === r.veiculo_id); return v ? { codigo: v.codigo ?? v.modelo.toUpperCase(), placa: v.placa ?? "" } : { codigo: "?", placa: "" }; };
  const trocar = () => { setCarro(null); setEscolhida(null); };
  const st = evento ? STATUS_EVENTO.find((s) => s.value === evento.status) : null;
  const est = reserva ? ESTADOS_RESERVA.find((s) => s.value === reserva.estado) : null;

  return (
    <Page wide>
      <div className="ds-stack" data-testid="pagina-checklists">
        <div><h1 className="t-h1">Checklists</h1><p className="t-body t-muted">Registre o envio e o retorno dos carros nos eventos: digite a placa, confira o carro e o evento, e salve.</p></div>

        <Segmented options={[{ value: "saida", label: "Envio" }, { value: "retorno", label: "Retorno" }, { value: "historico", label: "Histórico" }]} value={aba} onChange={(m) => { setAba(m); setEscolhida(null); setFeito(null); }} />
        {noHistorico ? <HistoricoDeChecklists checklists={d.ck.checklists} carro={carroDaReserva} evento={eventoDe} /> : <>
        {feito && <p className="t-body" role="status" data-testid="checklist-feito" style={{ color: "var(--color-success-fg)" }}><CheckCircle size={18} weight="fill" style={{ verticalAlign: "-3px" }} /> {feito}</p>}

        {!carro ? (
          <Card><div className="ds-stack"><b>1. Qual carro?</b><BuscaDeVeiculo veiculos={d.veiculos} onEscolher={(v) => { setCarro(v); setEscolhida(null); setFeito(null); }} /></div></Card>
        ) : (
          <>
            <Card>
              <div className="mt-chk-carro" data-testid="carro-escolhido">
                <div><span className="t-body-sm t-muted">Carro</span><h2 className="t-h2">{carro.placa ?? "sem placa"} · {carro.codigo ?? carro.modelo.toUpperCase()}</h2>
                  <p className="t-body">{[carro.modelo, carro.cor, carro.my].filter(Boolean).join(" · ")}</p></div>
                <Button variant="secondary" size="sm" icon={<ArrowLeft size={16} />} onClick={trocar} data-testid="trocar-carro">Trocar carro</Button>
              </div>
            </Card>

            {!reserva ? (
              <Card><div className="ds-stack" data-testid="sem-evento"><p className="t-body"><Warning size={18} weight="fill" style={{ verticalAlign: "-3px", color: "var(--color-warning-fg)" }} /> Este carro não tem evento aberto {momento === "saida" ? "esperando o envio" : "para o retorno"}.</p>
                <p className="t-body-sm t-muted">Reserve o carro num evento primeiro ({<Link to="/lancamentos?acao=reserva">Lançamentos → Reservar carros em evento</Link>}) ou confira se o checklist já foi feito.</p></div></Card>
            ) : (
              <>
                <Card>
                  <div className="ds-stack" data-testid="evento-do-checklist">
                    <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                      <b>2. Evento {momento === "saida" ? "para onde vai" : "de onde volta"}</b>
                      {candidatas.length > 1 && <div style={{ minWidth: 240 }}><Select value={reserva.id} onChange={(e) => setEscolhida(e.target.value)} aria-label="Escolher outro evento do carro">{candidatas.map((r) => <option key={r.id} value={r.id}>{d.eventos?.find((e) => e.id === r.evento_id)?.nome ?? "?"}{r.reserva_inicio ? ` · ${formatarDiaBr(r.reserva_inicio)}` : " · sem data"}</option>)}</Select></div>}
                    </div>
                    {evento && <EventoResumido evento={evento} reserva={reserva} statusTag={st && <Tag campoId="status" opcao={{ value: st.value, label: st.label, tom: st.tom }} />} estadoTag={est && <Tag campoId="estadoReserva" opcao={{ value: est.value, label: est.label, tom: est.tom }} />} cliente={cliente} local={local ? [local.rotulo, local.endereco].filter(Boolean).join(" · ") : null} />}
                    <p className="t-body-sm" style={{ color: "var(--color-success-fg)" }}><CheckCircle size={16} weight="fill" style={{ verticalAlign: "-3px" }} /> {candidatas.length > 1 ? `Escolhi o evento mais próximo de hoje (${candidatas.length} eventos abertos).` : "Tudo certo: é o único evento aberto deste carro."}</p>
                  </div>
                </Card>
                <Card>
                  <div className="ds-stack"><b>3. Checklist de {rotuloMomento(momento).toLowerCase()}</b>
                    <ChecklistRapido key={`${reserva.id}-${momento}`} momento={momento} recebidoPor={evento?.solicitante ?? undefined} existente={jaFeito} rotuloDoBotao={`Salvar o checklist de ${momento === "saida" ? "envio" : "retorno"}`}
                      onSalvar={async (dados) => { await d.ck.salvar(reserva.id, momento, null, dados); setFeito(`${carro.placa ?? carro.codigo ?? carro.modelo}: checklist de ${momento === "saida" ? "envio" : "retorno"} registrado em ${evento?.nome ?? "evento"}. Próximo carro.`); trocar(); }} /></div>
                </Card>
              </>
            )}
          </>
        )}

        {recentes.length > 0 && (
          <section className="ds-stack" data-testid="checklists-recentes">
            <h3 className="t-h3">Últimos checklists</h3>
            <ul className="mt-reservas">{recentes.map((c) => (
              <li key={c.id} className="mt-reserva"><div className="mt-reserva__topo"><b>{nomeDoCarro(c.reserva_id)}</b><span className="t-body-sm">{c.momento === "saida" ? "Envio" : "Retorno"} · {eventoDe(c.reserva_id)}</span></div><span className="t-body-sm t-muted">{quandoFoi(c.data_hora)}{c.km !== null ? ` · ${c.km.toLocaleString("pt-BR")} km` : ""}{c.teve_avarias ? " · com avarias" : ""}</span></li>
            ))}</ul>
          </section>
        )}
        </>}
      </div>
    </Page>
  );
}

function EventoResumido({ evento, reserva, statusTag, estadoTag, cliente, local }: { evento: Evento; reserva: ReservaDoEvento; statusTag: React.ReactNode; estadoTag: React.ReactNode; cliente: string | null; local: string | null }) {
  const periodo = reserva.reserva_inicio && reserva.reserva_fim ? `${formatarDiaBr(reserva.reserva_inicio)} a ${formatarDiaBr(reserva.reserva_fim)}` : "Sem data definida";
  return (
    <div className="mt-chk-evento">
      <div className="ds-row" style={{ flexWrap: "wrap", gap: 8 }}><LinkNoLugar to={`/eventos/${evento.id}`} className="mt-reserva__evento"><b className="t-h3">{evento.nome}</b></LinkNoLugar>{statusTag}{estadoTag}</div>
      <dl className="mt-chk-evento__dados">
        <div><dt>Período</dt><dd>{periodo}</dd></div>
        {cliente && <div><dt>Cliente</dt><dd>{cliente}</dd></div>}
        {evento.solicitante && <div><dt><User size={14} aria-hidden /> Entregar para</dt><dd>{evento.solicitante}</dd></div>}
        {evento.contato && <div><dt><Phone size={14} aria-hidden /> Contato</dt><dd>{evento.contato}</dd></div>}
        {local && <div><dt><MapPin size={14} aria-hidden /> Local</dt><dd>{local}</dd></div>}
      </dl>
    </div>
  );
}
