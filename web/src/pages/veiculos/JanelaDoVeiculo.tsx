import { LinkNoLugar } from "../../app/noLugar";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarBlank, CalendarCheck, Plus, Warning, Wrench, X } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { Skeleton, Textarea, cx, useToast } from "../../ds";
import { CampoEditavel, clicarNaLinha } from "../../components/motor/CampoEditavel";
import type { CampoDaTela } from "../../components/motor/tipos";
import { useEdicao, type OnEditar } from "../../components/motor/useEdicao";
import { formatar } from "../../components/motor/formatar";
import { listarAtividades, type Atividade } from "../../lib/veiculos/dados";
import { quando, textoAtividade } from "../../lib/veiculos/atividade";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { ESTADOS_RESERVA, type Evento, type Reserva } from "../../lib/eventos/tipos";
import { agendaTexto, estaAberta, rotuloDoUso, statusDeUso } from "../../lib/eventos/uso";
import { hojeLocal, formatarDiaBr } from "../../lib/motor/datas";
import { Tag } from "../../components/motor/Tag";
import { Button } from "../../ds";
import { NovaManutencao } from "../manutencoes/NovaManutencao";
import { STATUS_MANUTENCAO, type Manutencao, type ManutencaoNova } from "../../lib/manutencoes/tipos";
import "./veiculos.css";

type Aba = "dados" | "atividade" | "comentarios" | "agenda" | "eventos" | "manutencoes" | "multas";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "dados", rotulo: "Dados" }, { id: "atividade", rotulo: "Atividade" }, { id: "comentarios", rotulo: "Comentários" },
  { id: "agenda", rotulo: "Agenda" }, { id: "eventos", rotulo: "Eventos" }, { id: "manutencoes", rotulo: "Manutenções" }, { id: "multas", rotulo: "Multas" },
];

function EmBreve({ icone, titulo, children }: { icone: ReactNode; titulo: string; children: ReactNode }) {
  return <div className="mt-embreve" data-testid="aba-em-breve">{icone}<h3 className="t-h3">{titulo}</h3><p className="t-body t-muted">{children}</p></div>;
}

/** A janela do veículo: tudo sobre um carro, em abas. Dados e Comentários se editam no lugar, como na tabela e nos cards. */
function ListaDeReservas({ reservas, nome, vazio }: { reservas: Reserva[]; nome: (id: string) => string; vazio: string }) {
  if (reservas.length === 0) return <p className="t-body t-muted">{vazio}</p>;
  return (
    <ul className="mt-reservas" data-testid="lista-reservas">
      {reservas.map((r) => {
        const e = ESTADOS_RESERVA.find((x) => x.value === r.estado)!;
        return (
          <li key={r.id} className="mt-reserva">
            <div className="mt-reserva__topo"><LinkNoLugar to={`/eventos/${r.evento_id}`} className="mt-reserva__evento">{nome(r.evento_id)}</LinkNoLugar><Tag opcao={{ value: e.value, label: e.label, tom: e.tom }} /></div>
            <span className="t-body-sm t-muted">{formatarDiaBr(r.reserva_inicio)} até {formatarDiaBr(r.reserva_fim)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function JanelaDoVeiculo({ veiculo, campos, onEditar, onFechar, reservas, eventos, usoCarregado, manutencoes = [], manutencoesErro = null, onCriarManutencao }: { veiculo: Veiculo | null; campos: readonly CampoDaTela<Veiculo>[]; onEditar: OnEditar<Veiculo>; onFechar: () => void; reservas: Reserva[]; eventos: Evento[]; usoCarregado: boolean; manutencoes?: Manutencao[]; manutencoesErro?: string | null; onCriarManutencao?: (m: ManutencaoNova) => Promise<Manutencao> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [aba, setAba] = useState<Aba>("dados");
  const [hist, setHist] = useState<Atividade[] | null>(null);
  const ed = useEdicao<Veiculo>((v) => v.id, onEditar);
  const toast = useToast();
  const id = veiculo?.id;
  const [novaManutencao, setNovaManutencao] = useState(false);
  const [comentario, setComentario] = useState("");
  const [erroComentario, setErroComentario] = useState<string | null>(null);

  useEffect(() => { const d = ref.current; if (!d) return; if (id && !d.open) d.showModal(); if (!id && d.open) d.close(); }, [id]);
  useEffect(() => { setAba("dados"); setHist(null); }, [id]);
  useEffect(() => { setComentario(veiculo?.comentarios ?? ""); setErroComentario(null); }, [id, veiculo?.comentarios]);
  useEffect(() => { if (aba === "atividade" && id) { setHist(null); listarAtividades(id).then(setHist, () => setHist([])); } }, [aba, id, veiculo?.status_ciclo]);

  const nomeDoEvento = (id: string) => eventos.find((e) => e.id === id)?.nome ?? "?";
  const titulo = veiculo ? (veiculo.codigo ?? veiculo.modelo.toUpperCase()) : "";
  const editaveis = campos.filter((c) => c.edicao).map((c) => c.id);
  const lista = campos.filter((c) => c.id !== "codigo" && c.id !== "comentarios");
  const campoComentarios = campos.find((c) => c.id === "comentarios");

  async function salvarComentario() {
    if (!veiculo || !campoComentarios || comentario === (veiculo.comentarios ?? "")) return;
    setErroComentario(null);
    try { await onEditar(veiculo, campoComentarios, comentario.trim() === "" ? null : comentario); toast("Salvo"); } catch (e) { setErroComentario((e as Error).message); }
  }

  return (
    <dialog ref={ref} className="mt-janela" aria-label={`Veículo ${titulo}`} onClose={(e) => { if (e.target === e.currentTarget) onFechar(); }} onClick={(e) => { if (e.target === ref.current) onFechar(); }}>
      {veiculo && (
        <div className="mt-janela__corpo" data-testid="janela-veiculo">
          <header className="mt-janela__topo">
            <div><h2 className="t-h2" data-testid="titulo-janela">{titulo}</h2><div className="mt-janela__sub">{formatar(campos.find((c) => c.id === "ciclo")!, veiculo)}</div></div>
            <button type="button" className="mt-janela__fechar" aria-label="Fechar" onClick={onFechar}><X size={22} /></button>
          </header>
          <div className="mt-abas" role="tablist" aria-label="Seções do veículo">
            {ABAS.map((a) => <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={cx("mt-aba", aba === a.id && "is-on")} onClick={() => setAba(a.id)} data-testid="aba-janela">{a.rotulo}</button>)}
          </div>
          <div className="mt-janela__conteudo">
            {ed.erro && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{ed.erro}</span><button type="button" aria-label="Fechar aviso" onClick={() => ed.setErro(null)}><X size={16} /></button></p>}
            {aba === "dados" && (
              <dl className="mt-ficha" data-testid="ficha-dados">
                <div className="mt-ficha__linha" onClick={clicarNaLinha}><dt>Código</dt><dd><span className="mt-valor" style={{ fontWeight: 700 }}>{titulo}</span></dd></div>
                {lista.map((c) => <div key={c.id} className="mt-ficha__linha" onClick={clicarNaLinha}><dt>{c.titulo}</dt><dd><CampoEditavel linha={veiculo} campo={c} ed={ed} navegaveis={editaveis} /></dd></div>)}
              </dl>
            )}
            {aba === "atividade" && (hist === null ? <Skeleton h={20} /> : hist.length === 0 ? <p className="t-body t-muted">Sem atividade registrada.</p>
              : <ul className="vei-hist" data-testid="historico">{hist.map((a) => <li key={a.id}><span className="t-body">{textoAtividade(a.descricao)}</span><span className="t-body-sm t-muted">{quando(a.ocorreu_em)}</span></li>)}</ul>)}
            {aba === "comentarios" && (
              <div className="ds-stack">
                <p className="t-body-sm t-muted">Anotações livres sobre este carro. Salva ao sair do campo.</p>
                <Textarea rows={10} value={comentario} aria-label="Comentários do veículo" data-testid="campo-comentarios" onChange={(e) => setComentario(e.target.value)} onBlur={() => void salvarComentario()} />
                {erroComentario && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{erroComentario}</p>}
              </div>
            )}
            {aba === "agenda" && (usoCarregado ? (
              <div className="ds-stack" data-testid="aba-agenda">
                <div className="mt-agenda"><span className="t-body-sm t-muted">Status de uso</span><b>{rotuloDoUso(statusDeUso(reservas, manutencoes, hojeLocal()))}</b></div>
                <div className="mt-agenda"><span className="t-body-sm t-muted">Agenda</span><p className="t-body" data-testid="agenda-texto">{agendaTexto(reservas, nomeDoEvento, hojeLocal(), manutencoes) || "Sem reservas abertas: o carro está livre."}</p></div>
                <h3 className="t-h3">Reservas abertas</h3>
                <ListaDeReservas reservas={reservas.filter(estaAberta)} nome={nomeDoEvento} vazio="Nenhuma reserva aberta." />
              </div>
            ) : <EmBreve icone={<CalendarBlank size={32} />} titulo="Agenda do veículo">Os eventos e as reservas ainda não foram ativados no banco (falta aplicar a migration 0006).</EmBreve>)}
            {aba === "eventos" && (usoCarregado ? <ListaDeReservas reservas={[...reservas].sort((a, b) => b.reserva_inicio.localeCompare(a.reserva_inicio))} nome={nomeDoEvento} vazio="Este carro ainda não foi reservado para nenhum evento." />
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
          </div>
          {onCriarManutencao && <NovaManutencao aberto={novaManutencao} onFechar={() => setNovaManutencao(false)} veiculos={[veiculo]} veiculoInicial={veiculo.id} onCriar={onCriarManutencao} />}
        </div>
      )}
    </dialog>
  );
}
