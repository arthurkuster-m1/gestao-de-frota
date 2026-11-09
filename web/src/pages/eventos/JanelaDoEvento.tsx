import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowsIn, ArrowsOut, FileText, MapPin, Plus, Trash, Truck, X } from "@phosphor-icons/react";
import { Button, EmptyState, Sheet, Textarea, cx, useToast } from "../../ds";
import { CampoEditavel, clicarNaLinha } from "../../components/motor/CampoEditavel";
import { formatar } from "../../components/motor/formatar";
import { TelaDoMotor } from "../../components/motor/TelaDoMotor";
import type { CampoDaTela } from "../../components/motor/tipos";
import { useEdicao, type OnEditar } from "../../components/motor/useEdicao";
import { listarClientes, type ClienteResumo } from "../../lib/clientes/dados";
import type { Contrato } from "../../lib/contratos/tipos";
import type { Evento, EventoLocal, EventoLocalNovo, ModeloDesejado, Reserva } from "../../lib/eventos/tipos";
import type { Transporte } from "../../lib/transportes/tipos";
import type { Checklist, ChecklistNovo, Momento } from "../../lib/checklists/tipos";
import type { Manutencao } from "../../lib/manutencoes/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { camposDoContrato, type ContextoDeContratos } from "../contratos/camposDeContratos";
import { NovoContrato } from "../contratos/NovoContrato";
import { useContratos } from "../contratos/useContratos";
import { camposDoTransporte, type ContextoDeTransportes } from "../transportes/camposDeTransportes";
import { NovoTransporte } from "../transportes/NovoTransporte";
import type { useTransportes } from "../transportes/useTransportes";
import { camposDoLocal } from "./camposDoEvento";
import { FormularioDeLocais, localVazio } from "./FormularioDeLocais";
import { ModelosDesejadosForm, pedidoVazio, type PedidoDeCarro } from "./ModelosDesejadosForm";
import { VeiculosDoEvento } from "./VeiculosDoEvento";
import "../veiculos/veiculos.css";

export type AbaDoEvento = "dados" | "veiculos" | "transportes" | "contratos";
const ABAS: { id: AbaDoEvento; rotulo: string }[] = [{ id: "dados", rotulo: "Dados" }, { id: "veiculos", rotulo: "Veículos" }, { id: "transportes", rotulo: "Transportes" }, { id: "contratos", rotulo: "Contratos" }];

type Props = {
  /** Aba aberta (a tela escolhe onde guardá-la: no endereço ou na memória). */ aba: AbaDoEvento; onAba: (a: AbaDoEvento) => void;
  evento: Evento; campos: readonly CampoDaTela<Evento>[]; veiculos: Veiculo[]; reservas: Reserva[]; eventos: Evento[]; locais: EventoLocal[]; desejados: ModeloDesejado[]; manutencoes?: Manutencao[];
  tr: ReturnType<typeof useTransportes>; checklists?: Checklist[];
  onSalvarChecklist?: (reservaId: string, momento: Momento, existente: Checklist | null, dados: Omit<ChecklistNovo, "reserva_id" | "momento">) => Promise<void>;
  onEditarLocal: OnEditar<EventoLocal>; onAdicionarLocais: (eventoId: string, locais: EventoLocalNovo[]) => Promise<void>; onRemoverLocal: (l: EventoLocal) => Promise<void>;
  onEditarEvento: OnEditar<Evento>; onSalvarReserva: (id: string, patch: Partial<Pick<Reserva, "chegada" | "retirada" | "origem" | "endereco_chegada" | "status_individual">>) => Promise<void>;
  onReservar: (eventoId: string, veiculoIds: string[], inicio: string, fim: string, janela: { chegada: string; retirada: string }, pedidoId?: string) => Promise<void>;
  onRemoverReserva: (r: Reserva) => Promise<void>; onNaoAtendido: (id: string, naoAtendido: boolean) => Promise<void>; onAdicionarDesejados: (eventoId: string, pedidos: PedidoDeCarro[]) => Promise<void>;
  onExcluir: (e: Evento) => Promise<void>;
};

/**
 * A página inteira de um evento, com as subpáginas Dados, Veículos, Transportes e Contratos. Local e comentários moram em Dados
 * (como o cliente, logo abaixo do nome). O evento manda: transportes e contratos são os dele.
 */
export function ConteudoDoEvento(p: Props & { cheia: boolean; aoAlternarCheia: () => void; onFechar: () => void }) {
  const { evento, campos, tr, cheia, aoAlternarCheia, onFechar } = p;
  const navigate = useNavigate();
  const toast = useToast();
  const { aba, onAba } = p;
  const irParaAba = (id: string) => onAba(id as AbaDoEvento);
  const [falha, setFalha] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [novoLocal, setNovoLocal] = useState<EventoLocalNovo[] | null>(null);
  const [novoPedido, setNovoPedido] = useState<PedidoDeCarro[] | null>(null);
  const [comentario, setComentario] = useState(evento.comentarios ?? "");
  const [novoTransporte, setNovoTransporte] = useState(false);
  const [novoContrato, setNovoContrato] = useState(false);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const k = useContratos();
  useEffect(() => { listarClientes().then(setClientes, () => setClientes([])); }, []);
  useEffect(() => { setComentario(evento.comentarios ?? ""); }, [evento.id, evento.comentarios]);

  const edEvento = useEdicao<Evento>((e) => e.id, p.onEditarEvento);
  const edLocal = useEdicao<EventoLocal>((l) => l.id, p.onEditarLocal);
  const locaisDoEvento = useMemo(() => p.locais.filter((l) => l.evento_id === evento.id).sort((a, b) => a.posicao - b.posicao), [p.locais, evento.id]);
  const camposDeDados = campos.filter((c) => !["comentarios", "locais", "carros", "transporte"].includes(c.id));
  const editaveis = camposDeDados.filter((c) => c.edicao).map((c) => c.id);
  const campoComentarios = campos.find((c) => c.id === "comentarios");
  const campoStatus = campos.find((c) => c.id === "status");

  async function salvarComentario() {
    if (!campoComentarios || comentario === (evento.comentarios ?? "")) return;
    try { await p.onEditarEvento(evento, campoComentarios, comentario.trim() === "" ? null : comentario); toast("Salvo"); } catch (e) { setFalha((e as Error).message); }
  }

  // transportes e contratos DESTE evento
  const transportesDoEvento = useMemo(() => tr.transportes.filter((t) => t.evento_id === evento.id), [tr.transportes, evento.id]);
  const ctxT = useMemo<ContextoDeTransportes>(() => ({ eventos: new Map(p.eventos.map((e) => [e.id, e])), veiculos: new Map(p.veiculos.map((v) => [v.id, v])), reservas: p.reservas, vinculos: tr.vinculos, pagamentos: tr.pagamentos, transportes: tr.transportes }), [p.eventos, p.veiculos, p.reservas, tr.vinculos, tr.pagamentos, tr.transportes]);
  const camposT = useMemo(() => camposDoTransporte(ctxT), [ctxT]);
  const contratosDoEvento = useMemo(() => k.contratos.filter((c) => c.evento_id === evento.id), [k.contratos, evento.id]);
  const ctxC = useMemo<ContextoDeContratos>(() => {
    const rs = new Map<string, Reserva[]>(); for (const r of p.reservas) { const l = rs.get(r.evento_id); if (l) l.push(r); else rs.set(r.evento_id, [r]); }
    return { eventos: new Map(p.eventos.map((e) => [e.id, e])), clientes: new Map(clientes.map((c) => [c.id, c.nome])), veiculos: new Map(p.veiculos.map((v) => [v.id, v])), reservasDoEvento: rs, emVigor: k.emVigor };
  }, [p.eventos, p.reservas, p.veiculos, clientes, k.emVigor]);
  const camposC = useMemo(() => camposDoContrato(ctxC), [ctxC]);

  return (
    <div className="mt-janela__corpo" data-testid="janela-evento">
      <header className="mt-janela__topo">
        <div><h2 className="t-h2" data-testid="titulo-janela">{evento.nome}</h2>{campoStatus && <div className="mt-janela__sub">{formatar(campoStatus, evento)}</div>}</div>
        <div className="ds-row" style={{ gap: 8 }}>
          <button type="button" className="mt-janela__fechar mt-janela__expandir" aria-label={cheia ? "Voltar ao tamanho normal" : "Expandir para a tela cheia"} title={cheia ? "Reduzir" : "Expandir"} onClick={aoAlternarCheia} data-testid="expandir-evento">{cheia ? <ArrowsIn size={20} /> : <ArrowsOut size={20} />}</button>
          <button type="button" className="mt-janela__fechar" aria-label="Fechar" onClick={onFechar}><X size={22} /></button>
        </div>
      </header>
      <div className="mt-abas" role="tablist" aria-label="Seções do evento">
        {ABAS.map((a) => <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={cx("mt-aba", aba === a.id && "is-on")} onClick={() => irParaAba(a.id)} data-testid="aba-janela">{a.rotulo}</button>)}
      </div>
      <div className="mt-janela__conteudo">
        {(edEvento.erro || edLocal.erro || falha) && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{edEvento.erro ?? edLocal.erro ?? falha}</span><button type="button" aria-label="Fechar aviso" onClick={() => { edEvento.setErro(null); edLocal.setErro(null); setFalha(null); }}><X size={16} /></button></p>}

        {aba === "dados" && (
          <div className="ds-stack">
            <dl className="mt-ficha" data-testid="ficha-dados">
              {camposDeDados.map((c) => <div key={c.id} className="mt-ficha__linha" onClick={clicarNaLinha}><dt>{c.titulo}</dt><dd><CampoEditavel linha={evento} campo={c} ed={edEvento} navegaveis={editaveis} /></dd></div>)}
            </dl>

            <section className="ds-stack" data-testid="dados-locais">
              <div className="ds-row" style={{ justifyContent: "space-between" }}>
                <h3 className="t-h3"><MapPin size={18} style={{ verticalAlign: "-3px" }} /> Local do evento</h3>
                <Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={() => setNovoLocal([localVazio()])} data-testid="novo-local">Adicionar local</Button>
              </div>
              {locaisDoEvento.length === 0 && <p className="t-body-sm t-muted">Nenhum endereço ainda. Se os carros vão para mais de um lugar, adicione um local para cada um.</p>}
              {locaisDoEvento.map((l) => (
                <dl key={l.id} className="mt-ficha mt-ficha--local" data-testid="local">
                  {camposDoLocal.map((c) => <div key={c.id} className="mt-ficha__linha" onClick={clicarNaLinha}><dt>{c.titulo}</dt><dd><CampoEditavel linha={l} campo={c} ed={edLocal} navegaveis={camposDoLocal.map((x) => x.id)} /></dd></div>)}
                  <div className="mt-ficha__linha"><dt /><dd><Button variant="ghost" size="sm" icon={<Trash size={16} />} onClick={() => void p.onRemoverLocal(l).catch((e: Error) => setFalha(e.message))}>Remover local</Button></dd></div>
                </dl>
              ))}
            </section>

            <section className="ds-stack">
              <h3 className="t-h3">Comentários</h3>
              <Textarea rows={6} value={comentario} aria-label="Comentários do evento" placeholder="Anotações livres sobre o evento. Salva ao sair do campo." onChange={(e) => setComentario(e.target.value)} onBlur={() => void salvarComentario()} />
            </section>
            <div><Button variant="danger" icon={<Trash size={18} />} onClick={() => setExcluindo(true)} data-testid="excluir-evento">Excluir evento</Button></div>
          </div>
        )}

        {aba === "veiculos" && (
          <div className="mt-reservas-ed" data-testid="aba-veiculos">
            <div><Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={() => setNovoPedido([pedidoVazio()])} data-testid="novo-pedido">Pedir mais modelos</Button></div>
            <VeiculosDoEvento evento={evento} veiculos={p.veiculos} reservas={p.reservas} eventos={p.eventos} locais={p.locais} desejados={p.desejados} manutencoes={p.manutencoes} tr={tr}
              checklists={p.checklists} onSalvarChecklist={p.onSalvarChecklist} onSalvarReserva={p.onSalvarReserva} onReservar={p.onReservar} onRemoverReserva={p.onRemoverReserva} onNaoAtendido={p.onNaoAtendido} onErro={setFalha} />
          </div>
        )}

        {aba === "transportes" && (
          <TelaDoMotor<Transporte> tela="evento-transportes" titulo="Transportes" subtitulo="" compacta
            acoes={<Button icon={<Plus size={20} />} onClick={() => setNovoTransporte(true)} data-testid="novo-transporte">Novo transporte</Button>}
            linhas={tr.carregado ? transportesDoEvento : null} erro={tr.erro} campos={camposT} idDe={(t) => t.id} onEditar={tr.editarTransporte} onAbrir={(t) => navigate(`/transportes/${t.id}`)}
            rotuloDoTotal={(n) => `${n} transporte${n === 1 ? "" : "s"} deste evento`} placeholderDaBusca="Buscar transporte…"
            vazio={<EmptyState icon={<Truck size={30} />} title="Nenhum transporte neste evento" action={<Button icon={<Plus size={20} />} onClick={() => setNovoTransporte(true)}>Criar o primeiro</Button>}>Na aba Veículos, ligue “Transporte de ida/volta” em Colunas e cadastre a PTA direto na linha do carro.</EmptyState>} />
        )}

        {aba === "contratos" && (
          <TelaDoMotor<Contrato> tela="evento-contratos" titulo="Contratos" subtitulo="" compacta
            acoes={contratosDoEvento.length === 0 ? <Button icon={<Plus size={20} />} onClick={() => setNovoContrato(true)} data-testid="novo-contrato">Novo contrato</Button> : undefined}
            linhas={k.carregado ? contratosDoEvento : null} erro={k.erro} campos={camposC} idDe={(c) => c.id} onEditar={k.editar} onAbrir={(c) => navigate(`/contratos/${c.id}`)}
            rotuloDoTotal={(n) => `${n} contrato${n === 1 ? "" : "s"} deste evento`} placeholderDaBusca="Buscar contrato…"
            vazio={<EmptyState icon={<FileText size={30} />} title="Este evento ainda não tem contrato" action={<Button icon={<Plus size={20} />} onClick={() => setNovoContrato(true)}>Criar contrato</Button>}>O contrato de comodato nasce deste evento: cliente, vigência e carros vêm das reservas.</EmptyState>} />
        )}
      </div>
      <NovoTransporte aberto={novoTransporte} onFechar={() => setNovoTransporte(false)} eventos={[evento]} reservas={p.reservas} veiculos={p.veiculos} onCriar={tr.criarT} onCriado={() => setNovoTransporte(false)} />
      <NovoContrato aberto={novoContrato} onFechar={() => setNovoContrato(false)} eventos={[evento]} eventosComContrato={new Set(k.contratos.map((c) => c.evento_id))} clientes={clientes} reservas={p.reservas} veiculos={p.veiculos} onCriar={k.criar} onCriado={(c) => navigate(`/contratos/${c.id}`)} />
      <Sheet open={!!novoLocal} onClose={() => setNovoLocal(null)} title="Adicionar local">
        <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); if (!novoLocal) return; void p.onAdicionarLocais(evento.id, novoLocal).then(() => setNovoLocal(null)).catch((x: Error) => setFalha(x.message)); }}>
          <FormularioDeLocais locais={novoLocal ?? []} onChange={setNovoLocal} />
          <Button type="submit" size="lg" block disabled={!novoLocal?.some((l) => l.endereco.trim())} data-testid="salvar-locais">Salvar local</Button>
        </form>
      </Sheet>
      <Sheet open={!!novoPedido} onClose={() => setNovoPedido(null)} title="Pedir mais modelos" wide>
        <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); if (!novoPedido) return; void p.onAdicionarDesejados(evento.id, novoPedido.filter((x) => x.modelo.trim())).then(() => setNovoPedido(null)).catch((x: Error) => setFalha(x.message)); }}>
          <ModelosDesejadosForm pedidos={novoPedido ?? []} onChange={setNovoPedido} />
          <Button type="submit" size="lg" block disabled={!novoPedido?.some((x) => x.modelo.trim())}>Salvar pedido</Button>
        </form>
      </Sheet>
      <Sheet open={excluindo} onClose={() => setExcluindo(false)} title="Excluir evento">
        <div className="ds-stack">
          <p className="t-body">Excluir <b>{evento.nome}</b>? As reservas dele também somem e os carros ficam livres dessas datas. Não dá para desfazer.</p>
          <Button variant="danger" size="lg" block onClick={() => void p.onExcluir(evento).then(() => setExcluindo(false)).catch((e: Error) => { setFalha(e.message); setExcluindo(false); })} data-testid="confirmar-excluir">Excluir evento</Button>
        </div>
      </Sheet>
    </div>
  );
}

/** O evento abre em painel lateral, como sempre; o botão de expandir leva o MESMO painel para a tela cheia. */
export function JanelaDoEvento({ evento, onFechar, ...resto }: Omit<Props, "evento"> & { evento: Evento | null; onFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [cheia, setCheia] = useState(false);
  const id = evento?.id;
  useEffect(() => { const d = ref.current; if (!d) return; if (id && !d.open) d.showModal(); if (!id && d.open) d.close(); }, [id]);
  return (
    <dialog ref={ref} className={cx("mt-janela", cheia && "mt-janela--cheia")} aria-label={`Evento ${evento?.nome ?? ""}`}
      onClose={(e) => { if (e.target === e.currentTarget) onFechar(); }} onClick={(e) => { if (e.target === ref.current) onFechar(); }}>
      {evento && <ConteudoDoEvento evento={evento} {...resto} cheia={cheia} aoAlternarCheia={() => setCheia((c) => !c)} onFechar={onFechar} />}
    </dialog>
  );
}
