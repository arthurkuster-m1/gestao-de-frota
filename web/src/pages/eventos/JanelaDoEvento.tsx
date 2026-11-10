import { AlcaDoPainel } from "../../components/motor/AlcaDoPainel";
import { useVersaoDosDados } from "../../lib/sincronia";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowsIn, ArrowsOut, Copy, FileText, MapPin, Plus, Trash, Truck, X } from "@phosphor-icons/react";
import { Button, EmptyState, Sheet, Textarea, cx, useToast } from "../../ds";
import { CampoEditavel, clicarNaLinha } from "../../components/motor/CampoEditavel";
import { formatar } from "../../components/motor/formatar";
import { TelaDoMotor } from "../../components/motor/TelaDoMotor";
import type { CampoDaTela } from "../../components/motor/tipos";
import { useEdicao, type OnEditar } from "../../components/motor/useEdicao";
import { listarClientes, type ClienteResumo } from "../../lib/clientes/dados";
import type { Contrato } from "../../lib/contratos/tipos";
import type { Evento, EventoLocal, EventoLocalNovo, ModeloDesejado, Reserva, ReservaDoEvento } from "../../lib/eventos/tipos";
import type { Transporte } from "../../lib/transportes/tipos";
import type { Checklist, ChecklistNovo, Momento } from "../../lib/checklists/tipos";
import type { Manutencao } from "../../lib/manutencoes/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { camposDoContrato, type ContextoDeContratos } from "../contratos/camposDeContratos";
import { NovoContrato } from "../contratos/NovoContrato";
import { useContratos } from "../contratos/useContratos";
import { camposDoTransporte, type ContextoDeTransportes } from "../transportes/camposDeTransportes";
import type { useTransportes } from "../transportes/useTransportes";
import { camposDoLocal } from "./camposDoEvento";
import { JanelaDeEndereco } from "../../components/motor/EditorDeEndereco";
import { LinhaDeEndereco } from "./LinhaDeEndereco";
import { reais } from "../../lib/transportes/regras";
import { ORIGEM_PADRAO } from "../../lib/enderecos";
import { copiarTabela } from "../../lib/eventos/linhasDoEvento";
import { textoDoEvento } from "../../lib/eventos/textoDoEvento";
import { calcularDatasDoEvento } from "../../lib/eventos/rotasDoEvento";
import { distanciaEntre } from "../../lib/transportes/rota";
import { ModelosDesejadosForm, pedidoVazio, type PedidoDeCarro } from "./ModelosDesejadosForm";
import { VeiculosDoEvento } from "./VeiculosDoEvento";
import "../veiculos/veiculos.css";

export type AbaDoEvento = "dados" | "veiculos" | "transportes" | "contratos";
const ABAS: { id: AbaDoEvento; rotulo: string }[] = [{ id: "dados", rotulo: "Dados" }, { id: "veiculos", rotulo: "Veículos" }, { id: "transportes", rotulo: "Transportes" }, { id: "contratos", rotulo: "Contratos" }];

type Props = {
  /** Aba aberta (a tela escolhe onde guardá-la: no endereço ou na memória). */ aba: AbaDoEvento; onAba: (a: AbaDoEvento) => void;
  evento: Evento; campos: readonly CampoDaTela<Evento>[]; veiculos: Veiculo[]; reservas: Reserva[]; eventos: Evento[]; locais: EventoLocal[]; /** origens extras (além da principal) */ origens?: EventoLocal[]; desejados: ModeloDesejado[]; manutencoes?: Manutencao[];
  tr: ReturnType<typeof useTransportes>; checklists?: Checklist[];
  onSalvarChecklist?: (reservaId: string, momento: Momento, existente: Checklist | null, dados: Omit<ChecklistNovo, "reserva_id" | "momento">) => Promise<void>;
  onEditarLocal: OnEditar<EventoLocal>; onAdicionarLocais: (eventoId: string, locais: EventoLocalNovo[]) => Promise<void>; onRemoverLocal: (l: EventoLocal) => Promise<void>;
  onEditarEvento: OnEditar<Evento>; onSalvarReserva: (id: string, patch: Partial<Pick<Reserva, "chegada" | "retirada" | "origem" | "endereco_chegada" | "endereco_retorno" | "envio" | "retorno" | "comentarios" | "status_individual" | "reserva_inicio" | "reserva_fim">>) => Promise<void>;
  onChecklistEmMassa?: (reservaIds: string[], dados: import("../checklists/ChecklistEmMassaSheet").DadosEmMassa) => Promise<void>;
  reservasSemData?: ReservaDoEvento[]; onReservarSemData?: (eventoId: string, veiculoIds: string[], pedidoId?: string) => Promise<void>;
  onReservar: (eventoId: string, veiculoIds: string[], inicio: string, fim: string, janela: { chegada: string; retirada: string }, pedidoId?: string) => Promise<void>;
  onRemoverReserva: (r: { id: string }) => Promise<void>; onNaoAtendido: (id: string, naoAtendido: boolean) => Promise<void>; onAdicionarDesejados: (eventoId: string, pedidos: PedidoDeCarro[]) => Promise<void>;
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
  const [adicionando, setAdicionando] = useState<"origem" | "local" | null>(null);
  const [novoPedido, setNovoPedido] = useState<PedidoDeCarro[] | null>(null);
  const [comentario, setComentario] = useState(evento.comentarios ?? "");
  const [novoContrato, setNovoContrato] = useState(false);
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const k = useContratos();
  const versao = useVersaoDosDados();
  useEffect(() => { listarClientes().then(setClientes, () => setClientes([])); }, [versao]);
  useEffect(() => { setComentario(evento.comentarios ?? ""); }, [evento.id, evento.comentarios]);

  const edEvento = useEdicao<Evento>((e) => e.id, p.onEditarEvento);
  const locaisDoEvento = useMemo(() => p.locais.filter((l) => l.evento_id === evento.id).sort((a, b) => a.posicao - b.posicao), [p.locais, evento.id]);
  const editaveis = campos.filter((c) => c.edicao && c.id !== "comentarios").map((c) => c.id);
  const campoComentarios = campos.find((c) => c.id === "comentarios");
  const campoStatus = campos.find((c) => c.id === "status");
  const campoOrigem = campos.find((c) => c.id === "origem");
  const campoEnderecoLocal = camposDoLocal.find((c) => c.id === "endereco")!;
  const origensExtras = useMemo(() => (p.origens ?? []).filter((l) => l.evento_id === evento.id).sort((a, b) => a.posicao - b.posicao), [p.origens, evento.id]);
  async function copiarDados() {
    const t = textoDoEvento({ evento, reservas: [...p.reservas, ...(p.reservasSemData ?? [])], veiculos: p.veiculos, locais: p.locais, origensExtras: p.origens ?? [], transportes: tr.transportes });
    toast((await copiarTabela({ html: t.html, texto: t.texto })) ? "Dados do evento copiados" : "Não consegui copiar. Libere a área de transferência no navegador.");
  }
  const [calculando, setCalculando] = useState(false);
  const [resultadoRotas, setResultadoRotas] = useState<string | null>(null);
  /** Mede a ida e a volta, gera o envio (chegada − dias da ida) e o retorno (retirada + dias da volta) do evento e de cada carro. */
  async function calcularRotas() {
    setCalculando(true); setResultadoRotas(null); setFalha(null);
    try {
      const reservas = [...p.reservas, ...(p.reservasSemData ?? [])];
      const r = await calcularDatasDoEvento({ evento, reservas, locais: p.locais, distancia: (o, d) => distanciaEntre(o, d) });
      const grava = async (id: string, valor: string | number | null) => { const c = campos.find((x) => x.id === id); if (c && valor !== null) await p.onEditarEvento(evento, c, valor as never); };
      await grava("distIda", r.kmIda); await grava("distVolta", r.kmVolta); await grava("envio", r.envio); await grava("retorno", r.retorno);
      for (const c of r.porCarro) {
        const atual = reservas.find((x) => x.id === c.reservaId); if (!atual) continue;
        const envio = c.envio && c.envio !== r.envio ? c.envio : null, retorno = c.retorno && c.retorno !== r.retorno ? c.retorno : null;   // igual ao do evento = herda
        // o período da reserva passa a ser envio → retorno (a logística), com chegada e retirada marcando o evento: é isso que colore a agenda do carro e a linha do tempo
        const periodo = c.envio && c.retorno && c.chegada && c.retirada ? { reserva_inicio: c.envio, reserva_fim: c.retorno, chegada: c.chegada, retirada: c.retirada } : {};
        const igual = (atual.envio ?? null) === envio && (atual.retorno ?? null) === retorno && (!("reserva_inicio" in periodo) || (atual.reserva_inicio === periodo.reserva_inicio && atual.reserva_fim === periodo.reserva_fim && atual.chegada === periodo.chegada && atual.retirada === periodo.retirada));
        if (!igual) await p.onSalvarReserva(c.reservaId, { envio, retorno, ...periodo });
      }
      const dm = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");
      const km = (n: number | null) => (n === null ? "—" : `≈ ${n.toLocaleString("pt-BR")} km (${Math.ceil(n / 500)} dia${Math.ceil(n / 500) === 1 ? "" : "s"})`);
      setResultadoRotas([`Ida ${km(r.kmIda)} → envio ${dm(r.envio)}`, `Volta ${km(r.kmVolta)} → retorno ${dm(r.retorno)}`, ...r.avisos].join(" · "));
    } catch (e) { setFalha((e as Error).message); } finally { setCalculando(false); }
  }
  const campoRetorno = campos.find((c) => c.id === "enderecoRetorno");
  /** Uma linha da ficha para um campo editável do evento. */
  const linhaCampo = (id: string) => { const c = campos.find((x) => x.id === id); return c ? <div key={id} className="mt-ficha__linha" onClick={clicarNaLinha}><dt>{c.titulo}</dt><dd><CampoEditavel linha={evento} campo={c} ed={edEvento} navegaveis={editaveis} /></dd></div> : null; };
  const areaDeComentario = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const t = areaDeComentario.current; if (t) { t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; } }, [comentario, aba]);   // cresce com o texto
  /** Custos: ida e volta somam os transportes do evento (valor planejado); extras é digitado. */
  const custos = useMemo(() => {
    const soma = (sentido: string) => tr.transportes.filter((t) => t.evento_id === evento.id && t.sentido === sentido).reduce((a, t) => a + (t.valor_planejado ?? 0), 0);
    const envio = soma("ida"), retorno = soma("volta"), extras = evento.custos_extras ?? 0;
    return { envio, retorno, extras, total: envio + retorno + extras };
  }, [tr.transportes, evento.id, evento.custos_extras]);
  const erro = (e: unknown) => setFalha((e as Error).message);
  /** Salvar um endereço de local ou origem extra: texto novo troca, vazio remove. */
  const salvarLocal = (l: EventoLocal, v: string | null) => (v ? p.onEditarLocal(l, campoEnderecoLocal, v) : p.onRemoverLocal(l)).catch(erro);
  const salvarOrigemPrincipal = (v: string | null) => { if (campoOrigem) void p.onEditarEvento(evento, campoOrigem, v).catch(erro); };

  async function salvarComentario() {
    if (!campoComentarios || comentario === (evento.comentarios ?? "")) return;
    try { await p.onEditarEvento(evento, campoComentarios, comentario.trim() === "" ? null : comentario); toast("Salvo"); } catch (e) { setFalha((e as Error).message); }
  }

  // transportes e contratos DESTE evento
  const transportesDoEvento = useMemo(() => tr.transportes.filter((t) => t.evento_id === evento.id && !!t.referencia), [tr.transportes, evento.id]);
  const ctxT = useMemo<ContextoDeTransportes>(() => ({ eventos: new Map(p.eventos.map((e) => [e.id, e])), veiculos: new Map(p.veiculos.map((v) => [v.id, v])), reservas: p.reservas, vinculos: tr.vinculos, transportes: tr.transportes, checklists: p.checklists ?? [] }), [p.eventos, p.veiculos, p.reservas, tr.vinculos, tr.transportes, p.checklists]);
  const camposT = useMemo(() => camposDoTransporte(ctxT), [ctxT]);
  const contratosDoEvento = useMemo(() => k.contratos.filter((c) => c.evento_id === evento.id), [k.contratos, evento.id]);
  const ctxC = useMemo<ContextoDeContratos>(() => {
    const rs = new Map<string, Reserva[]>(); for (const r of p.reservas) { const l = rs.get(r.evento_id); if (l) l.push(r); else rs.set(r.evento_id, [r]); }
    return { eventos: new Map(p.eventos.map((e) => [e.id, e])), clientes: new Map(clientes.map((c) => [c.id, c.nome])), veiculos: new Map(p.veiculos.map((v) => [v.id, v])), reservasDoEvento: rs, emVigor: k.emVigor };
  }, [p.eventos, p.reservas, p.veiculos, clientes, k.emVigor]);
  const camposC = useMemo(() => camposDoContrato(ctxC), [ctxC]);

  return (
    <div className="mt-janela__corpo" data-testid="janela-evento">
          <AlcaDoPainel />
      <header className="mt-janela__topo">
        <div><h2 className="t-h2" data-testid="titulo-janela">{evento.nome}</h2>{campoStatus && <div className="mt-janela__sub">{formatar(campoStatus, evento)}</div>}</div>
        <div className="ds-row" style={{ gap: 8 }}>
          <button type="button" className="mt-janela__fechar mt-janela__expandir" aria-label="Copiar dados do evento" title="Copiar dados do evento (para a transportadora)" onClick={() => void copiarDados()} data-testid="copiar-dados-evento"><Copy size={20} /></button>
          <button type="button" className="mt-janela__fechar mt-janela__expandir" aria-label={cheia ? "Voltar ao tamanho normal" : "Expandir para a tela cheia"} title={cheia ? "Reduzir" : "Expandir"} onClick={aoAlternarCheia} data-testid="expandir-evento">{cheia ? <ArrowsIn size={20} /> : <ArrowsOut size={20} />}</button>
          <button type="button" className="mt-janela__fechar" aria-label="Fechar" onClick={onFechar}><X size={22} /></button>
        </div>
      </header>
      <div className="mt-abas" role="tablist" aria-label="Seções do evento">
        {ABAS.map((a) => <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={cx("mt-aba", aba === a.id && "is-on")} onClick={() => irParaAba(a.id)} data-testid="aba-janela">{a.rotulo}</button>)}
      </div>
      <div className="mt-janela__conteudo">
        {(edEvento.erro || falha) && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{edEvento.erro ?? falha}</span><button type="button" aria-label="Fechar aviso" onClick={() => { edEvento.setErro(null); setFalha(null); }}><X size={16} /></button></p>}

        {aba === "dados" && (
          <div className="ds-stack mt-dados">
            <section data-testid="secao-dados">
              <SecaoDoDados titulo="Dados" />
              <dl className="mt-ficha" data-testid="ficha-dados">
                {["nome", "cliente", "tipo", "status", "solicitante", "cadastradoEm"].map(linhaCampo)}
                <div className="mt-ficha__linha mt-ficha__linha--topo"><dt>Comentários</dt><dd>
                  <textarea ref={areaDeComentario} className="ds-textarea mt-comentario-auto" rows={1} value={comentario} aria-label="Comentários do evento" placeholder="Anotações livres sobre o evento. Salva ao sair do campo."
                    onChange={(e) => setComentario(e.target.value)} onBlur={() => void salvarComentario()} />
                </dd></div>
              </dl>
            </section>

            <section data-testid="secao-logistica">
              <SecaoDoDados titulo="Logística" acao={<Button size="sm" variant="secondary" icon={<MapPin size={16} />} loading={calculando} onClick={() => void calcularRotas()} data-testid="calcular-rotas">Calcular Rotas</Button>} />
              <dl className="mt-ficha" data-testid="ficha-logistica">{["envio", "inicio", "distIda", "fim", "retorno", "distVolta"].map(linhaCampo)}</dl>
              <p className="t-body-sm t-muted" role="status" data-testid="calcular-rotas-evento">{resultadoRotas ?? "Calcular Rotas mede a ida (origem → local) e a volta (local → retorno) pelo mapa. Envio = chegada menos os dias de viagem; retorno = retirada mais os dias de viagem (km ÷ 500). As datas vão para a agenda do carro e para a linha do tempo."}</p>
            </section>

            <section data-testid="secao-enderecos">
              <SecaoDoDados titulo="Endereços" />
              <dl className="mt-ficha" data-testid="ficha-enderecos">
                <LinhaDeEndereco sugestao={ORIGEM_PADRAO} titulo="Local de Origem" valor={evento.origem ?? null} onSalvar={salvarOrigemPrincipal} onAdicionar={() => setAdicionando("origem")} rotuloAdicionar="Adicionar outra origem" testid="linha-origem" />
                {origensExtras.map((l, i) => <LinhaDeEndereco sugestao={ORIGEM_PADRAO} key={l.id} titulo={`Local de Origem ${i + 2}`} valor={l.endereco} onSalvar={(v) => void salvarLocal(l, v)} onRemover={() => void p.onRemoverLocal(l).catch(erro)} testid="linha-origem-extra" />)}
                {linhaCampo("contatoOrigem")}
                {locaisDoEvento.length === 0
                  ? <LinhaDeEndereco titulo="Local do Evento" valor={null} onSalvar={(v) => { if (v) void p.onAdicionarLocais(evento.id, [{ endereco: v }]).catch(erro); }} onAdicionar={() => setAdicionando("local")} rotuloAdicionar="Adicionar outro local" testid="linha-local" />
                  : locaisDoEvento.map((l, i) => <LinhaDeEndereco key={l.id} titulo={i === 0 ? "Local do Evento" : `Local do Evento ${i + 1}`} valor={l.endereco} onSalvar={(v) => void salvarLocal(l, v)} onAdicionar={i === 0 ? () => setAdicionando("local") : undefined} rotuloAdicionar="Adicionar outro local" onRemover={i === 0 ? undefined : () => void p.onRemoverLocal(l).catch(erro)} testid="linha-local" />)}
                {linhaCampo("contato")}
                <LinhaDeEndereco titulo="Local do Retorno" valor={evento.endereco_retorno ?? null} placeholder="Vazio = volta para a origem" onSalvar={(v) => { if (campoRetorno) void p.onEditarEvento(evento, campoRetorno, v).catch(erro); }} testid="linha-retorno" />
                {linhaCampo("contatoRetorno")}
              </dl>
            </section>

            <section data-testid="secao-custos">
              <SecaoDoDados titulo="Custos" />
              <dl className="mt-ficha" data-testid="ficha-custos">
                <div className="mt-ficha__linha"><dt>Custos de Envio</dt><dd className="mt-valor-fixo" data-testid="custo-envio">{reais(custos.envio)}</dd></div>
                <div className="mt-ficha__linha"><dt>Custos de Retorno</dt><dd className="mt-valor-fixo" data-testid="custo-retorno">{reais(custos.retorno)}</dd></div>
                {linhaCampo("custosExtras")}
                <div className="mt-ficha__linha mt-ficha__linha--total"><dt>Total</dt><dd className="mt-valor-fixo" data-testid="custo-total"><b>{reais(custos.total)}</b></dd></div>
              </dl>
              <p className="t-body-sm t-muted">Envio e retorno somam os transportes de ida e de volta cadastrados nos carros do evento (valor planejado).</p>
            </section>

            <JanelaDeEndereco sugestao={adicionando === "origem" ? ORIGEM_PADRAO : undefined} aberto={adicionando !== null} titulo={adicionando === "origem" ? "Nova origem" : "Novo local"} valor={null} onFechar={() => setAdicionando(null)}
              onSalvar={(t) => { const tipo = adicionando; setAdicionando(null); if (t && tipo) void p.onAdicionarLocais(evento.id, [{ endereco: t, tipo }]).catch(erro); }} />

            <div><Button variant="danger" icon={<Trash size={18} />} onClick={() => setExcluindo(true)} data-testid="excluir-evento">Excluir evento</Button></div>
          </div>
        )}

        {aba === "veiculos" && (
          <div className="mt-reservas-ed" data-testid="aba-veiculos">
            <div><Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={() => setNovoPedido([pedidoVazio()])} data-testid="novo-pedido">Pedir mais modelos</Button></div>
            <VeiculosDoEvento onChecklistEmMassa={p.onChecklistEmMassa} evento={evento} veiculos={p.veiculos} reservas={p.reservas} reservasSemData={p.reservasSemData} onReservarSemData={p.onReservarSemData} eventos={p.eventos} locais={p.locais} desejados={p.desejados} manutencoes={p.manutencoes} tr={tr}
              checklists={p.checklists} onSalvarChecklist={p.onSalvarChecklist} onSalvarReserva={p.onSalvarReserva} onReservar={p.onReservar} onRemoverReserva={p.onRemoverReserva} onNaoAtendido={p.onNaoAtendido} onErro={setFalha} />
          </div>
        )}

        {aba === "transportes" && (
          <TelaDoMotor<Transporte> tela="evento-transportes" titulo="Transportes" subtitulo="" compacta
            linhas={tr.carregado ? transportesDoEvento : null} erro={tr.erro} campos={camposT} idDe={(t) => t.id} onEditar={tr.editarTransporte} onAbrir={(t) => navigate(`/transportes/${t.id}`)}
            rotuloDoTotal={(n) => `${n} transporte${n === 1 ? "" : "s"} deste evento`} placeholderDaBusca="Buscar transporte…"
            vazio={<EmptyState icon={<Truck size={30} />} title="Nenhum transporte neste evento">Na aba Veículos, ligue “Transporte de ida/volta” em Colunas e cadastre a PTA direto na linha do carro.</EmptyState>} />
        )}

        {aba === "contratos" && (
          <TelaDoMotor<Contrato> tela="evento-contratos" titulo="Contratos" subtitulo="" compacta
            acoes={contratosDoEvento.length === 0 ? <Button icon={<Plus size={20} />} onClick={() => setNovoContrato(true)} data-testid="novo-contrato">Novo contrato</Button> : undefined}
            linhas={k.carregado ? contratosDoEvento : null} erro={k.erro} campos={camposC} idDe={(c) => c.id} onEditar={k.editar} onAbrir={(c) => navigate(`/contratos/${c.id}`)}
            rotuloDoTotal={(n) => `${n} contrato${n === 1 ? "" : "s"} deste evento`} placeholderDaBusca="Buscar contrato…"
            vazio={<EmptyState icon={<FileText size={30} />} title="Este evento ainda não tem contrato" action={<Button icon={<Plus size={20} />} onClick={() => setNovoContrato(true)}>Criar contrato</Button>}>O contrato de comodato nasce deste evento: cliente, vigência e carros vêm das reservas.</EmptyState>} />
        )}
      </div>
      <NovoContrato aberto={novoContrato} onFechar={() => setNovoContrato(false)} eventos={[evento]} eventosComContrato={new Set(k.contratos.map((c) => c.evento_id))} clientes={clientes} reservas={p.reservas} veiculos={p.veiculos} onCriar={k.criar} onCriado={(c) => navigate(`/contratos/${c.id}`)} />
      <Sheet open={!!novoPedido} onClose={() => setNovoPedido(null)} title="Pedir mais modelos" wide>
        <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); if (!novoPedido) return; void p.onAdicionarDesejados(evento.id, novoPedido.filter((x) => x.modelo.trim())).then(() => setNovoPedido(null)).catch((x: Error) => setFalha(x.message)); }}>
          <ModelosDesejadosForm pedidos={novoPedido ?? []} onChange={setNovoPedido} />
          <Button type="submit" size="lg" block disabled={!novoPedido?.some((x) => x.modelo.trim())}>Salvar pedido</Button>
        </form>
      </Sheet>
      <Sheet open={excluindo} onClose={() => setExcluindo(false)} title="Excluir evento">
        <div className="ds-stack">
          <p className="t-body">Excluir <b>{evento.nome}</b>? Tudo o que é dele também some: reservas e checklists dos carros, transportes e pagamentos, contratos, locais e pedidos de modelo. Os carros ficam livres dessas datas. Não dá para desfazer.</p>
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

/** Subtítulo divisor de uma seção da aba Dados; `acao` fica alinhada à direita, na mesma linha. */
function SecaoDoDados({ titulo, acao }: { titulo: string; acao?: ReactNode }) {
  return <div className="mt-secao"><h3 className="t-h3">{titulo}</h3>{acao}</div>;
}
