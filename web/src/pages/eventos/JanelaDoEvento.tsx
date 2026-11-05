import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Plus, Trash, Warning, X } from "@phosphor-icons/react";
import { Button, Sheet, Textarea, cx, useToast } from "../../ds";
import { CampoEditavel } from "../../components/motor/CampoEditavel";
import { formatar } from "../../components/motor/formatar";
import type { CampoDaTela } from "../../components/motor/tipos";
import { useEdicao, type OnEditar } from "../../components/motor/useEdicao";
import { hojeLocal } from "../../lib/motor/datas";
import type { Evento, EventoLocal, EventoLocalNovo, Reserva } from "../../lib/eventos/tipos";
import { agendaTexto, conflitos, reservasPorVeiculo } from "../../lib/eventos/uso";
import type { Veiculo } from "../../lib/veiculos/tipos";
import type { Manutencao } from "../../lib/manutencoes/tipos";
import { AdicionarVeiculos } from "./AdicionarVeiculos";
import { camposDaReserva, camposDoLocal, type ReservaLinha } from "./camposDoEvento";
import { FormularioDeLocais, localVazio } from "./FormularioDeLocais";
import "../veiculos/veiculos.css";

export type AbaDoEvento = "dados" | "veiculos" | "locais" | "comentarios";
type Aba = AbaDoEvento;
const ABAS: { id: Aba; rotulo: string }[] = [{ id: "dados", rotulo: "Dados" }, { id: "veiculos", rotulo: "Veículos" }, { id: "locais", rotulo: "Locais" }, { id: "comentarios", rotulo: "Comentários" }];

type Props = {
  evento: Evento | null; campos: readonly CampoDaTela<Evento>[]; abaInicial: Aba; veiculos: Veiculo[]; reservas: Reserva[]; eventos: Evento[]; locais: EventoLocal[]; manutencoes?: Manutencao[];
  onEditarLocal: OnEditar<EventoLocal>; onAdicionarLocais: (eventoId: string, locais: EventoLocalNovo[]) => Promise<void>; onRemoverLocal: (l: EventoLocal) => Promise<void>;
  onEditarEvento: OnEditar<Evento>; onEditarReserva: OnEditar<ReservaLinha>; onReservar: (eventoId: string, veiculoIds: string[], inicio: string, fim: string, janela: { chegada: string; retirada: string }) => Promise<void>;
  onRemoverReserva: (r: Reserva) => Promise<void>; onExcluir: (e: Evento) => Promise<void>; onFechar: () => void;
};

/** A janela do evento: dados, os carros reservados (período e estado editáveis no lugar, com aviso de conflito) e comentários. */
export function JanelaDoEvento({ evento, campos, abaInicial, veiculos, reservas, eventos, locais, manutencoes, onEditarLocal, onAdicionarLocais, onRemoverLocal, onEditarEvento, onEditarReserva, onReservar, onRemoverReserva, onExcluir, onFechar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [adicionando, setAdicionando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [novoLocal, setNovoLocal] = useState<EventoLocalNovo[] | null>(null);
  const [enviandoLocal, setEnviandoLocal] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const id = evento?.id;
  const edEvento = useEdicao<Evento>((e) => e.id, onEditarEvento);
  const edReserva = useEdicao<ReservaLinha>((r) => r.id, onEditarReserva);
  const edLocal = useEdicao<EventoLocal>((l) => l.id, onEditarLocal);

  useEffect(() => { const d = ref.current; if (!d) return; if (id && !d.open) d.showModal(); if (!id && d.open) d.close(); }, [id]);
  useEffect(() => { setAba(abaInicial); }, [id, abaInicial]);
  useEffect(() => { setComentario(evento?.comentarios ?? ""); }, [id, evento?.comentarios]);

  const veiculoPorId = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos]);
  const nomes = useMemo(() => new Map(eventos.map((e) => [e.id, e.nome])), [eventos]);
  const porCarro = useMemo(() => reservasPorVeiculo(reservas), [reservas]);
  const linhas: ReservaLinha[] = useMemo(() => reservas.filter((r) => r.evento_id === id).map((r) => {
    const v = veiculoPorId.get(r.veiculo_id);
    const choques = conflitos({ inicio: r.reserva_inicio, fim: r.reserva_fim }, porCarro.get(r.veiculo_id) ?? [], r.evento_id);
    return { ...r, codigo: v ? (v.codigo ?? v.modelo.toUpperCase()) : "?", conflito: r.estado !== "cancelado" && r.estado !== "concluido" && choques.length ? agendaTexto(choques, (x) => nomes.get(x) ?? "?", hojeLocal()) : null };
  }).sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })), [reservas, id, veiculoPorId, porCarro, nomes]);

  const locaisDoEvento = useMemo(() => locais.filter((l) => l.evento_id === id).sort((a, b) => a.posicao - b.posicao), [locais, id]);
  const navegaveisLocal = camposDoLocal.map((c) => c.id);
  const editaveisEvento = campos.filter((c) => c.edicao).map((c) => c.id);
  const camposDaLinha = camposDaReserva.filter((c) => c.edicao);
  const navegaveisReserva = camposDaLinha.map((c) => c.id);
  const campoComentarios = campos.find((c) => c.id === "comentarios");

  async function salvarComentario() {
    if (!evento || !campoComentarios || comentario === (evento.comentarios ?? "")) return;
    try { await onEditarEvento(evento, campoComentarios, comentario.trim() === "" ? null : comentario); toast("Salvo"); } catch (e) { setFalha((e as Error).message); }
  }

  return (
    <dialog ref={ref} className="mt-janela" aria-label={`Evento ${evento?.nome ?? ""}`} onClose={(e) => { if (e.target === e.currentTarget) onFechar(); }} onClick={(e) => { if (e.target === ref.current) onFechar(); }}>
      {evento && (
        <div className="mt-janela__corpo" data-testid="janela-evento">
          <header className="mt-janela__topo">
            <div><h2 className="t-h2" data-testid="titulo-janela">{evento.nome}</h2><div className="mt-janela__sub">{formatar(campos.find((c) => c.id === "status")!, evento)}</div></div>
            <button type="button" className="mt-janela__fechar" aria-label="Fechar" onClick={onFechar}><X size={22} /></button>
          </header>
          <div className="mt-abas" role="tablist" aria-label="Seções do evento">
            {ABAS.map((a) => <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={cx("mt-aba", aba === a.id && "is-on")} onClick={() => setAba(a.id)} data-testid="aba-janela">{a.rotulo}{a.id === "veiculos" && linhas.length > 0 ? ` (${linhas.length})` : ""}{a.id === "locais" && locaisDoEvento.length > 0 ? ` (${locaisDoEvento.length})` : ""}</button>)}
          </div>
          <div className="mt-janela__conteudo">
            {(edEvento.erro || edReserva.erro || edLocal.erro || falha) && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{edEvento.erro ?? edReserva.erro ?? edLocal.erro ?? falha}</span><button type="button" aria-label="Fechar aviso" onClick={() => { edEvento.setErro(null); edReserva.setErro(null); edLocal.setErro(null); setFalha(null); }}><X size={16} /></button></p>}

            {aba === "dados" && (
              <>
                <dl className="mt-ficha" data-testid="ficha-dados">
                  {campos.filter((c) => c.id !== "comentarios").map((c) => <div key={c.id} className="mt-ficha__linha"><dt>{c.titulo}</dt><dd><CampoEditavel linha={evento} campo={c} ed={edEvento} navegaveis={editaveisEvento} /></dd></div>)}
                </dl>
                <div><Button variant="danger" icon={<Trash size={18} />} onClick={() => setExcluindo(true)} data-testid="excluir-evento">Excluir evento</Button></div>
              </>
            )}

            {aba === "veiculos" && (
              <div className="mt-reservas-ed" data-testid="aba-veiculos">
                <div className="ds-row" style={{ justifyContent: "space-between" }}>
                  <h3 className="t-h3">Carros deste evento</h3>
                  <Button icon={<Plus size={18} />} onClick={() => setAdicionando(true)} data-testid="adicionar-carros">Reservar carros</Button>
                </div>
                {linhas.length === 0 && <p className="t-body t-muted">Nenhum carro reservado ainda. O Status de uso e a Agenda dos carros se atualizam sozinhos quando você reserva.</p>}
                {linhas.map((r) => (
                  <article key={r.id} className="mt-reserva-ed" data-testid="reserva">
                    <div className="mt-reserva-ed__topo">
                      <Link to={`/veiculos/${r.veiculo_id}`} className="mt-reserva__evento">{r.codigo}</Link>
                      <Button variant="ghost" size="icon" aria-label={`Remover ${r.codigo} do evento`} onClick={() => void onRemoverReserva(r).catch((e: Error) => setFalha(e.message))}><Trash size={20} /></Button>
                    </div>
                    <div className="mt-reserva-ed__campos">
                      {camposDaLinha.map((c) => <div key={c.id}><span className="rot">{c.titulo}</span><CampoEditavel linha={r} campo={c} ed={edReserva} navegaveis={navegaveisReserva} /></div>)}
                    </div>
                    {r.conflito && <p className="mt-escolha__aviso" role="note" data-testid="aviso-conflito"><Warning size={16} weight="fill" />Este carro também está em: {r.conflito}</p>}
                  </article>
                ))}
              </div>
            )}

            {aba === "locais" && (
              <div className="mt-reservas-ed" data-testid="aba-locais">
                <div className="ds-row" style={{ justifyContent: "space-between" }}>
                  <h3 className="t-h3">Onde é o evento</h3>
                  <Button icon={<Plus size={18} />} onClick={() => setNovoLocal([localVazio()])} data-testid="novo-local">Adicionar local</Button>
                </div>
                {locaisDoEvento.length === 0 && <p className="t-body t-muted">Nenhum endereço ainda. Digite onde o evento acontece; se os carros vão para mais de um lugar, adicione um local para cada.</p>}
                {locaisDoEvento.map((l) => (
                  <article key={l.id} className="mt-reserva-ed" data-testid="local">
                    <div className="mt-reserva-ed__topo"><span className="mt-reserva__evento"><MapPin size={16} style={{ verticalAlign: "-3px" }} /> {l.rotulo || "Local"}</span>
                      <Button variant="ghost" size="icon" aria-label={`Remover local ${l.rotulo || l.endereco}`} onClick={() => void onRemoverLocal(l).catch((e: Error) => setFalha(e.message))}><Trash size={20} /></Button></div>
                    <div className="mt-reserva-ed__campos">
                      {camposDoLocal.map((c) => <div key={c.id}><span className="rot">{c.titulo}</span><CampoEditavel linha={l} campo={c} ed={edLocal} navegaveis={navegaveisLocal} /></div>)}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {aba === "comentarios" && (
              <div className="ds-stack">
                <p className="t-body-sm t-muted">Anotações livres sobre o evento. Salva ao sair do campo.</p>
                <Textarea rows={10} value={comentario} aria-label="Comentários do evento" onChange={(e) => setComentario(e.target.value)} onBlur={() => void salvarComentario()} />
              </div>
            )}
          </div>

          <AdicionarVeiculos aberto={adicionando} onFechar={() => setAdicionando(false)} evento={evento} veiculos={veiculos} reservas={reservas} eventos={eventos} manutencoes={manutencoes} onReservar={(ids, ini, fim, janela) => onReservar(evento.id, ids, ini, fim, janela)} />
          <Sheet open={!!novoLocal} onClose={() => setNovoLocal(null)} title="Adicionar local">
            <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); if (!novoLocal) return; setEnviandoLocal(true); void onAdicionarLocais(evento.id, novoLocal).then(() => setNovoLocal(null), (er: Error) => setFalha(er.message)).finally(() => setEnviandoLocal(false)); }}>
              <FormularioDeLocais locais={novoLocal ?? []} onChange={setNovoLocal} />
              <Button type="submit" size="lg" block loading={enviandoLocal} disabled={!novoLocal?.some((l) => l.endereco.trim())} data-testid="salvar-locais">Salvar {novoLocal && novoLocal.length > 1 ? "locais" : "local"}</Button>
            </form>
          </Sheet>
          <Sheet open={excluindo} onClose={() => setExcluindo(false)} title="Excluir evento">
            <div className="ds-stack">
              <p className="t-body">Excluir <b>{evento.nome}</b>? As {linhas.length} reserva{linhas.length === 1 ? "" : "s"} também somem e os carros ficam livres dessas datas. Não dá para desfazer.</p>
              <Button variant="danger" size="lg" block onClick={() => void onExcluir(evento).then(() => setExcluindo(false)).catch((e: Error) => { setFalha(e.message); setExcluindo(false); })} data-testid="confirmar-exclusao">Excluir evento</Button>
            </div>
          </Sheet>
        </div>
      )}
    </dialog>
  );
}
