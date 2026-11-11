import { AlcaDoPainel } from "../../components/motor/AlcaDoPainel";
import { LinkNoLugar } from "../../app/noLugar";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarBlank, CalendarCheck, Plus, Trash, Warning, Wrench, X } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { Skeleton, cx, useToast } from "../../ds";
import { CampoEditavel, clicarNaLinha } from "../../components/motor/CampoEditavel";
import type { CampoDaTela } from "../../components/motor/tipos";
import { useEdicao, type OnEditar } from "../../components/motor/useEdicao";
import { formatar } from "../../components/motor/formatar";
import { listarAtividades, type Atividade } from "../../lib/veiculos/dados";
import { quando, textoAtividade } from "../../lib/veiculos/atividade";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { ESTADOS_RESERVA, type Evento, type EventoLocal, type Reserva, type ReservaDoEvento } from "../../lib/eventos/tipos";
import { STATUS_DE_USO, agendaItens, rotuloDoUso, statusDeUso } from "../../lib/eventos/uso";
import { barrasDoVeiculo } from "../../lib/eventos/barras";
import { barrasDeManutencao } from "../../lib/manutencoes/barras";
import { AgendaDoCarro, type ItemDaAgenda } from "./AgendaDoCarro";
import { AgendaEmTags } from "./AgendaEmTags";
import { EventosDoVeiculo } from "./EventosDoVeiculo";
import { RegistrarAcoes } from "./RegistrarAcoes";
import { hojeLocal, formatarDiaBr } from "../../lib/motor/datas";
import { Tag } from "../../components/motor/Tag";
import { Button } from "../../ds";
import { ExcluirVeiculos } from "./ExcluirVeiculos";
import { NovaManutencao } from "../manutencoes/NovaManutencao";
import { STATUS_MANUTENCAO, type Manutencao, type ManutencaoNova } from "../../lib/manutencoes/tipos";
import { AlertaDeDivergencia } from "../contratos/AlertaDeDivergencia";
import { useDivergenciasDeContratos } from "../contratos/useDivergencias";
import "./veiculos.css";

type Aba = "dados" | "agenda" | "eventos" | "manutencoes" | "multas" | "historico";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "dados", rotulo: "Dados" }, { id: "agenda", rotulo: "Agenda" }, { id: "eventos", rotulo: "Eventos" },
  { id: "manutencoes", rotulo: "Manutenções" }, { id: "multas", rotulo: "Multas" }, { id: "historico", rotulo: "Histórico" },
];
/** A ficha em blocos, com divisor: Uso, Dados e Datas (o resto das propriedades fica fora da ficha). */
const BLOCOS: { titulo: string; ids: string[] }[] = [
  { titulo: "Uso", ids: ["codigo", "statusUso", "agenda", "comentarios"] },
  { titulo: "Dados", ids: ["placa", "vin", "modelo", "cor", "my", "blindado", "faturado", "pedido", "ciclo", "departamento", "seguro"] },
  { titulo: "Datas", ids: ["pedidoEm", "liberadoEm", "chegouPlantaEm", "faturadoEm", "placasSolicitadasEm", "emplacadoEm", "devolvidoEm"] },
  { titulo: "Prazos da placa", ids: ["diasParaSolicitar", "diasParaEmplacar", "diasTotalPlaca"] },
];

function EmBreve({ icone, titulo, children }: { icone: ReactNode; titulo: string; children: ReactNode }) {
  return <div className="mt-embreve" data-testid="aba-em-breve">{icone}<h3 className="t-h3">{titulo}</h3><p className="t-body t-muted">{children}</p></div>;
}

/** A janela do veículo: tudo sobre um carro, em abas. Dados e Comentários se editam no lugar, como na tabela e nos cards. */
function ListaDeReservas({ reservas, nome, vazio }: { reservas: ReservaDoEvento[]; nome: (id: string) => string; vazio: string }) {
  if (reservas.length === 0) return <p className="t-body t-muted">{vazio}</p>;
  return (
    <ul className="mt-reservas" data-testid="lista-reservas">
      {reservas.map((r) => {
        const e = ESTADOS_RESERVA.find((x) => x.value === r.estado)!;
        return (
          <li key={r.id} className="mt-reserva">
            <div className="mt-reserva__topo"><LinkNoLugar to={`/eventos/${r.evento_id}`} className="mt-reserva__evento">{nome(r.evento_id)}</LinkNoLugar><Tag opcao={{ value: e.value, label: e.label, tom: e.tom }} /></div>
            <span className="t-body-sm t-muted">{r.reserva_inicio && r.reserva_fim ? `${formatarDiaBr(r.reserva_inicio)} até ${formatarDiaBr(r.reserva_fim)}` : "Sem data definida"}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function JanelaDoVeiculo({ reservasSemData = [], clientes = new Map<string, string>(), locais = [], veiculo, campos, onEditar, onFechar, reservas, eventos, usoCarregado, manutencoes = [], manutencoesErro = null, onCriarManutencao }: { /** carros deste veículo em eventos ainda sem data */ reservasSemData?: ReservaDoEvento[]; /** nomes dos clientes (id → nome) e locais dos eventos, para a pesquisa na aba Eventos */ clientes?: ReadonlyMap<string, string>; locais?: readonly EventoLocal[]; veiculo: Veiculo | null; campos: readonly CampoDaTela<Veiculo>[]; onEditar: OnEditar<Veiculo>; onFechar: () => void; reservas: Reserva[]; eventos: Evento[]; usoCarregado: boolean; manutencoes?: Manutencao[]; manutencoesErro?: string | null; onCriarManutencao?: (m: ManutencaoNova) => Promise<Manutencao> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [aba, setAba] = useState<Aba>("dados");
  const [hist, setHist] = useState<Atividade[] | null>(null);
  const ed = useEdicao<Veiculo>((v) => v.id, onEditar);
  const toast = useToast();
  const id = veiculo?.id;
  const divergenciasDoCarro = useDivergenciasDeContratos().filter((a) => !!id && a.veiculoIds.includes(id));
  const [novaManutencao, setNovaManutencao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => { const d = ref.current; if (!d) return; if (id && !d.open) d.showModal(); if (!id && d.open) d.close(); }, [id]);
  useEffect(() => { setAba("dados"); setHist(null); }, [id]);
  useEffect(() => { if (aba === "historico" && id) { setHist(null); listarAtividades(id).then(setHist, () => setHist([])); } }, [aba, id, veiculo?.status_ciclo]);

  const nomeDoEvento = (id: string) => eventos.find((e) => e.id === id)?.nome ?? "?";
  const titulo = veiculo ? (veiculo.codigo ?? veiculo.modelo.toUpperCase()) : "";
  const editaveis = campos.filter((c) => c.edicao).map((c) => c.id);
  const hoje = hojeLocal();
  const statusAtual = statusDeUso(reservas, manutencoes, hoje, veiculo?.status_ciclo);
  const itensTexto = agendaItens(reservas, nomeDoEvento, hoje, manutencoes);
  /** Compromissos COM data (calendário e linha do tempo) e eventos do carro sem data (ficam só numa lista). */
  const comData = reservas.filter((r) => r.estado !== "cancelado");
  const semData = reservasSemData.filter((r) => r.estado !== "cancelado");
  const itensDaAgenda: ItemDaAgenda[] = [
    ...barrasDoVeiculo(comData, nomeDoEvento).map((b) => ({ ...b, href: `/eventos/${(b.dados as { eventoId: string }).eventoId}` })),
    ...barrasDeManutencao(manutencoes, hoje).map((b) => ({ ...b, href: `/manutencoes/${b.id}` })),
  ];


  return (
    <dialog ref={ref} className="mt-janela" aria-label={`Veículo ${titulo}`} onClose={(e) => { if (e.target === e.currentTarget) onFechar(); }} onClick={(e) => { if (e.target === ref.current) onFechar(); }}>
      {veiculo && (
        <div className="mt-janela__corpo" data-testid="janela-veiculo">
          <AlcaDoPainel />
          <header className="mt-janela__topo">
            <div><h2 className="t-h2" data-testid="titulo-janela">{titulo}</h2><div className="mt-janela__sub">{formatar(campos.find((c) => c.id === "ciclo")!, veiculo)}</div></div>
            <button type="button" className="mt-janela__fechar" aria-label="Fechar" onClick={onFechar}><X size={22} /></button>
          </header>
          <div className="mt-abas" role="tablist" aria-label="Seções do veículo">
            {ABAS.map((a) => <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={cx("mt-aba", aba === a.id && "is-on")} onClick={() => setAba(a.id)} data-testid="aba-janela">{a.rotulo}</button>)}
          </div>
          <div className="mt-janela__conteudo">
            <AlertaDeDivergencia alertas={divergenciasDoCarro} comEvento />
            {ed.erro && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{ed.erro}</span><button type="button" aria-label="Fechar aviso" onClick={() => ed.setErro(null)}><X size={16} /></button></p>}
            {aba === "dados" && (
              <div className="ds-stack">
                <dl className="mt-ficha" data-testid="ficha-dados">
                  {BLOCOS.map((bl) => (
                    <div key={bl.titulo} style={{ display: "contents" }}>
                      <h3 className="mt-ficha__divisor" data-testid="divisor-ficha">{bl.titulo}</h3>
                      {bl.ids.map((cid) => {
                        if (cid === "codigo") return <div key={cid} className="mt-ficha__linha"><dt>Código</dt><dd><span className="mt-valor" style={{ fontWeight: 600 }}>{titulo}</span></dd></div>;
                        const c = campos.find((x) => x.id === cid); if (!c) return null;
                        return <div key={cid} className="mt-ficha__linha" onClick={clicarNaLinha}><dt>{c.titulo}</dt><dd><CampoEditavel linha={veiculo} campo={c} ed={ed} navegaveis={editaveis} /></dd></div>;
                      })}
                    </div>
                  ))}
                </dl>
                <div><Button variant="danger" icon={<Trash size={18} />} onClick={() => setExcluindo(true)} data-testid="excluir-veiculo">Excluir veículo</Button></div>
                <ExcluirVeiculos aberto={excluindo} onFechar={() => setExcluindo(false)} veiculos={[veiculo]} consequencias={{ reservas: reservas.length + reservasSemData.length, manutencoes: manutencoes.length }} onExcluido={onFechar} />
              </div>
            )}
            {aba === "agenda" && (usoCarregado ? (
              <div className="ds-stack" data-testid="aba-agenda">
                <div className="mt-agenda"><span className="t-body-sm t-muted">Status de uso</span><span><Tag campoId="statusUso" opcao={{ value: statusAtual, label: rotuloDoUso(statusAtual), tom: STATUS_DE_USO.find((u) => u.value === statusAtual)?.tom }} /></span></div>
                <div className="mt-agenda"><span className="t-body-sm t-muted">Agenda</span><span data-testid="agenda-texto">{itensTexto.length ? <AgendaEmTags itens={itensTexto} /> : <span className="t-body">Sem reservas abertas: o carro está livre.</span>}</span></div>
                <h3 className="t-h3">Calendário do carro</h3>
                <AgendaDoCarro itens={itensDaAgenda} />
                {semData.length > 0 && (
                  <section className="ds-stack" data-testid="eventos-sem-data">
                    <h3 className="t-h3">Eventos sem data</h3>
                    <p className="t-body-sm t-muted">O carro está cadastrado nestes eventos, mas eles ainda não têm data: por isso não aparecem no calendário nem na linha do tempo.</p>
                    <ListaDeReservas reservas={semData} nome={nomeDoEvento} vazio="" />
                  </section>
                )}
              </div>
            ) : <EmBreve icone={<CalendarBlank size={32} />} titulo="Agenda do veículo">Os eventos e as reservas ainda não foram ativados no banco (falta aplicar a migration 0006).</EmBreve>)}
            {aba === "eventos" && (usoCarregado ? <EventosDoVeiculo reservas={[...reservas, ...reservasSemData]} eventos={eventos} clientes={clientes} locais={locais} />
              : <EmBreve icone={<CalendarCheck size={32} />} titulo="Eventos">Os eventos e as reservas ainda não foram ativados no banco (falta aplicar a migration 0006).</EmBreve>)}
            {aba === "manutencoes" && (manutencoesErro ? <EmBreve icone={<Wrench size={32} />} titulo="Manutenções">{manutencoesErro}</EmBreve> : (
              <div className="mt-reservas-ed" data-testid="aba-manutencoes">
                <div className="ds-row" style={{ justifyContent: "space-between" }}>
                  <h3 className="t-h3">Manutenções e sinistros</h3>
                  {onCriarManutencao && <Button icon={<Plus size={18} />} onClick={() => setNovaManutencao(true)} data-testid="nova-manutencao-do-carro">Nova manutenção</Button>}
                </div>
                {manutencoes.length === 0 && <p className="t-body t-muted">Este carro não tem manutenção registrada.</p>}
                <ul className="mt-reservas" data-testid="lista-manutencoes">
                  {[...manutencoes].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio)).map((m) => {
                    const s = STATUS_MANUTENCAO.find((x) => x.value === m.status)!;
                    return (
                      <li key={m.id} className="mt-reserva">
                        <div className="mt-reserva__topo"><Link to={`/manutencoes/${m.id}`} className="mt-reserva__evento">{m.nome}</Link><Tag opcao={{ value: s.value, label: s.label, tom: s.tom }} /></div>
                        <span className="t-body-sm t-muted">{[m.tipo, `${formatarDiaBr(m.data_inicio)} até ${m.data_fim ? formatarDiaBr(m.data_fim) : "em aberto"}`, m.bloqueia_uso ? "bloqueia o uso" : "não bloqueia o uso"].filter(Boolean).join(" · ")}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {aba === "multas" && <EmBreve icone={<Warning size={32} />} titulo="Multas">Multas do carro, com o evento e o cliente que estavam com ele na hora. Entra com a tela de Multas.</EmBreve>}
            {aba === "historico" && <RegistrarAcoes veiculo={veiculo} />}
            {aba === "historico" && (hist === null ? <Skeleton h={20} /> : hist.length === 0 ? <p className="t-body t-muted">Sem atividade registrada.</p>
              : <ul className="vei-hist" data-testid="historico">{hist.map((a) => <li key={a.id}><span className="t-body">{textoAtividade(a.descricao)}</span><span className="t-body-sm t-muted">{quando(a.ocorreu_em)}</span></li>)}</ul>)}
          </div>
          {onCriarManutencao && <NovaManutencao aberto={novaManutencao} onFechar={() => setNovaManutencao(false)} veiculos={[veiculo]} veiculoInicial={veiculo.id} onCriar={onCriarManutencao} />}
        </div>
      )}
    </dialog>
  );
}
