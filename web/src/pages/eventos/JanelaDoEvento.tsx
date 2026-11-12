import { AlcaDoPainel } from "../../components/motor/AlcaDoPainel";
import { useVersaoDosDados } from "../../lib/sincronia";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowsIn, ArrowsOut, Copy, FileText, MapPin, Plus, Trash, Truck, X } from "@phosphor-icons/react";
import { FormCliente } from "../clientes/FormCliente";
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
import { contatoDoEndereco, lembrarContato, useContatosDeEndereco } from "../../lib/eventos/contatosDeEndereco";
import { useTiposDeEvento } from "../../lib/eventos/tiposDeEvento";
import { GerarContrato } from "../contratos/GerarContrato";
import { AlertaDeDivergencia } from "../contratos/AlertaDeDivergencia";
import { useDivergenciasDeContratos } from "../contratos/useDivergencias";
import { JanelaDoContrato } from "../contratos/JanelaDoContrato";
import { baixarAditivoDocx, baixarContratoDocx } from "../contratos/baixar";
import { useContatosDosClientes } from "../contratos/useContatosDosClientes";
import { useContratos } from "../contratos/useContratos";
import { camposDoTransporte, type ContextoDeTransportes } from "../transportes/camposDeTransportes";
import type { useTransportes } from "../transportes/useTransportes";
import { camposDoLocal } from "./camposDoEvento";
import { JanelaDeEndereco, type EnderecoConhecido } from "../../components/motor/EditorDeEndereco";
import { LinhaDeEndereco } from "./LinhaDeEndereco";
import { diasDeViagem, reais } from "../../lib/transportes/regras";
import { ORIGEM_PADRAO } from "../../lib/enderecos";
import { copiarTabela } from "../../lib/eventos/linhasDoEvento";
import { textoDoEvento } from "../../lib/eventos/textoDoEvento";
import { calcularDatasDoEvento } from "../../lib/eventos/rotasDoEvento";
import { distanciaEntre } from "../../lib/transportes/rota";
import { ModelosDesejadosForm, pedidoVazio, type PedidoDeCarro } from "./ModelosDesejadosForm";
import { TabelaDePedidos } from "./TabelaDePedidos";
import { atendimentoDosPedidos } from "../../lib/eventos/desejados";
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
  onChecklistRetornoEmMassa?: (reservaIds: string[], dados: import("../checklists/ChecklistEmMassaSheet").DadosEmMassa) => Promise<void>;
  onChecklistEmMassa?: (reservaIds: string[], dados: import("../checklists/ChecklistEmMassaSheet").DadosEmMassa) => Promise<void>;
  reservasSemData?: ReservaDoEvento[]; onReservarSemData?: (eventoId: string, veiculoIds: string[], pedidoId?: string) => Promise<void>;
  onReservar: (eventoId: string, veiculoIds: string[], inicio: string, fim: string, janela: { chegada: string; retirada: string }, pedidoId?: string) => Promise<void>;
  onRemoverReserva: (r: { id: string }) => Promise<void>; onNaoAtendido: (id: string, naoAtendido: boolean) => Promise<void>; onRemoverDesejado?: (id: string) => Promise<void>; onNotaDoPedido?: (id: string, nota: string | null) => Promise<void>; onAdicionarDesejados: (eventoId: string, pedidos: PedidoDeCarro[]) => Promise<void>;
  onExcluir: (e: Evento) => Promise<void>;
};

/**
 * A página inteira de um evento, com as subpáginas Dados, Veículos, Transportes e Contratos. Local e comentários moram em Dados
 * (como o cliente, logo abaixo do nome). O evento manda: transportes e contratos são os dele.
 */
export function ConteudoDoEvento(p: Props & { cheia: boolean; aoAlternarCheia: () => void; onFechar: () => void }) {
  const { evento, tr, cheia, aoAlternarCheia, onFechar } = p;
  const [criandoCliente, setCriandoCliente] = useState<string | null>(null);   // nome digitado: abre o cadastro completo do cliente por cima da ficha
  const campos = useMemo(() => p.campos.map((c) => (c.id === "cliente" && c.edicao ? { ...c, edicao: { ...c.edicao, criarNovo: { rotulo: "Criar novo cliente", aoCriar: (t: string) => setCriandoCliente(t) } } } : c)), [p.campos]);
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

  useContatosDeEndereco();   // carrega os contatos lembrados por endereço
  // salvar um contato (da origem, do local ou do retorno) lembra o contato daquele endereço: o mesmo endereço volta com o mesmo contato
  const editarEvento: OnEditar<Evento> = async (linha, campo, valor) => {
    await p.onEditarEvento(linha, campo, valor);
    const v = typeof valor === "string" ? valor.trim() : "";
    if (!v) return;
    if (campo.id === "contatoOrigem") void lembrarContato(linha.origem, v);
    else if (campo.id === "contato") void lembrarContato(p.locais.filter((l) => l.evento_id === linha.id && (l.tipo ?? "local") === "local").sort((a, b) => a.posicao - b.posicao)[0]?.endereco, v);
    else if (campo.id === "contatoRetorno") void lembrarContato(linha.endereco_retorno ?? linha.origem, v);
  };
  const edEvento = useEdicao<Evento>((e) => e.id, editarEvento);
  const pedidosDoEvento = useMemo(() => p.desejados.filter((x) => x.evento_id === evento.id), [p.desejados, evento.id]);
  const atendidos = useMemo(() => atendimentoDosPedidos(pedidosDoEvento, [...p.reservas, ...(p.reservasSemData ?? [])].filter((r) => r.evento_id === evento.id), new Map(p.veiculos.map((v) => [v.id, v]))), [pedidosDoEvento, p.reservas, p.reservasSemData, p.veiculos, evento.id]);
  const locaisDoEvento = useMemo(() => p.locais.filter((l) => l.evento_id === evento.id).sort((a, b) => a.posicao - b.posicao), [p.locais, evento.id]);
  const editaveis = campos.filter((c) => c.edicao && c.id !== "comentarios").map((c) => c.id);
  const campoComentarios = campos.find((c) => c.id === "comentarios");
  const campoStatus = campos.find((c) => c.id === "status");
  const campoOrigem = campos.find((c) => c.id === "origem");
  const campoOrigemNome = campos.find((c) => c.id === "origemNome");
  const campoContatoOrigem = campos.find((c) => c.id === "contatoOrigem"), campoContato = campos.find((c) => c.id === "contato"), campoContatoRetorno = campos.find((c) => c.id === "contatoRetorno");
  /** Endereço com contato conhecido e contato do evento vazio: o contato entra sozinho. */
  const preencherContato = async (campoDoContato: typeof campoContato, atual: string | null | undefined, endereco: string | null) => {
    const c = endereco ? contatoDoEndereco(endereco) : null;
    if (campoDoContato && c && !(atual ?? "").trim()) await p.onEditarEvento(evento, campoDoContato, c);
  };
  const campoEnderecoLocal = camposDoLocal.find((c) => c.id === "endereco")!;
  const origensExtras = useMemo(() => (p.origens ?? []).filter((l) => l.evento_id === evento.id).sort((a, b) => a.posicao - b.posicao), [p.origens, evento.id]);
  async function copiarDados() {
    const t = textoDoEvento({ semRetorno: tiposDeEvento.semRetorno(evento.tipo), evento, reservas: [...p.reservas, ...(p.reservasSemData ?? [])], veiculos: p.veiculos, locais: p.locais, origensExtras: p.origens ?? [], transportes: tr.transportes });
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
      const km = (n: number | null) => (n === null ? "—" : `≈ ${n.toLocaleString("pt-BR")} km (${diasDeViagem(n, "pta")} dia${diasDeViagem(n, "pta") === 1 ? "" : "s"})`);
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
  const campoRotuloLocal: CampoDaTela<EventoLocal> = { ...campoEnderecoLocal, id: "rotulo", titulo: "Nome do local", valorDe: (l) => l.rotulo, edicao: { coluna: "rotulo", maxLength: 120 } };
  // endereços que já existem no sistema (de todos os eventos), para oferecer ao digitar o nome do local ou o nome de um evento
  const conhecidos = useMemo<EnderecoConhecido[]>(() => { const nomes = new Map(p.eventos.map((e) => [e.id, e.nome])); return [...p.locais.filter((l) => l.endereco).map((l) => ({ nome: l.rotulo, endereco: l.endereco, evento: nomes.get(l.evento_id) ?? null })), ...p.eventos.filter((e) => e.origem).map((e) => ({ nome: e.origem_rotulo ?? null, endereco: e.origem!, evento: e.nome })), ...p.eventos.filter((e) => e.endereco_retorno).map((e) => ({ nome: null, endereco: e.endereco_retorno!, evento: e.nome }))]; }, [p.locais, p.eventos]);   // origem, local e retorno vivem no mesmo banco de endereços
  const salvarLocal = async (l: EventoLocal, v: string | null, n?: string | null) => {
    try {
      if (!v) { await p.onRemoverLocal(l); return; }
      if (n !== undefined && (n ?? null) !== (l.rotulo ?? null)) await p.onEditarLocal(l, campoRotuloLocal, n);
      await p.onEditarLocal({ ...l, rotulo: n === undefined ? l.rotulo : n }, campoEnderecoLocal, v);
      if ((l.tipo ?? "local") === "local" && locaisDoEvento[0]?.id === l.id) await preencherContato(campoContato, evento.contato, v);
    } catch (e) { erro(e as Error); }
  };
  const salvarOrigemPrincipal = async (v: string | null, n?: string | null) => {
    try {
      if (!campoOrigem) return;
      if (n !== undefined && campoOrigemNome && (n ?? null) !== (evento.origem_rotulo ?? null)) await p.onEditarEvento(evento, campoOrigemNome, n);
      await p.onEditarEvento(evento, campoOrigem, v);
      await preencherContato(campoContatoOrigem, evento.contato_origem, v);
    } catch (e) { erro(e as Error); }
  };

  async function salvarComentario() {
    if (!campoComentarios || comentario === (evento.comentarios ?? "")) return;
    try { await p.onEditarEvento(evento, campoComentarios, comentario.trim() === "" ? null : comentario); toast("Salvo"); } catch (e) { setFalha((e as Error).message); }
  }

  // transportes e contratos DESTE evento
  const transportesDoEvento = useMemo(() => tr.transportes.filter((t) => t.evento_id === evento.id && !!t.referencia), [tr.transportes, evento.id]);
  const ctxT = useMemo<ContextoDeTransportes>(() => ({ eventos: new Map(p.eventos.map((e) => [e.id, e])), veiculos: new Map(p.veiculos.map((v) => [v.id, v])), reservas: p.reservas, vinculos: tr.vinculos, transportes: tr.transportes, checklists: p.checklists ?? [] }), [p.eventos, p.veiculos, p.reservas, tr.vinculos, tr.transportes, p.checklists]);
  const camposT = useMemo(() => camposDoTransporte(ctxT), [ctxT]);
  const contratosDoEvento = useMemo(() => k.contratos.filter((c) => c.evento_id === evento.id), [k.contratos, evento.id]);
  const tiposDeEvento = useTiposDeEvento();
  const divergenciasDoEvento = useDivergenciasDeContratos().filter((a) => a.eventoId === evento.id);
  const contatos = useContatosDosClientes(k.contratos.map((c) => c.cliente_id));
  const ctxC = useMemo<ContextoDeContratos>(() => {
    const rs = new Map<string, Reserva[]>(); for (const r of p.reservas) { const l = rs.get(r.evento_id); if (l) l.push(r); else rs.set(r.evento_id, [r]); }
    return { eventos: new Map(p.eventos.map((e) => [e.id, e])), clientes: new Map(clientes.map((c) => [c.id, c.nome])), veiculos: new Map(p.veiculos.map((v) => [v.id, v])), reservasDoEvento: rs, emVigor: k.emVigor, locais: p.locais, contatos };
  }, [p.eventos, p.reservas, p.veiculos, p.locais, clientes, k.emVigor, contatos]);
  const [idContrato, setIdContrato] = useState<string | null>(null);
  const contratoAberto = idContrato ? (contratosDoEvento.find((c) => c.id === idContrato) ?? null) : null;
  const ctxCDocs = useMemo<ContextoDeContratos>(() => ({ ...ctxC, docs: {
    carros: k.carros, itens: k.itens,
    baixarContrato: (c) => void baixarContratoDocx(c, ctxC, k.carros).catch((e: Error) => toast(e.message)),
    baixarAditivo: (c, a, n) => void baixarAditivoDocx(c, a, n, ctxC, k.itens).catch((e: Error) => toast(e.message)),
  } }), [ctxC, k.carros, k.itens, toast]);
  const camposC = useMemo(() => camposDoContrato(ctxCDocs), [ctxCDocs]);
  // Enquanto o contrato não é assinado, ele acompanha o evento (cliente, vigência e carros); depois de assinado, o que mudar vira "dados divergentes" e aditivo.
  const sincronizando = useRef(false);
  useEffect(() => {
    if (!k.carregado || sincronizando.current) return;
    const abertos = contratosDoEvento.filter((c) => c.status !== "assinado" && c.status !== "encerrado");
    if (abertos.length === 0) return;
    sincronizando.current = true;
    void (async () => {
      for (const c of abertos) {
        try { await k.sincronizar(c, { evento, clienteId: evento.cliente_id ?? c.cliente_id, reservas: p.reservas.filter((r) => r.evento_id === evento.id), veiculos: new Map(p.veiculos.map((v) => [v.id, v])), locais: p.locais }); } catch { /* tenta de novo na próxima mudança */ }
      }
    })().finally(() => { sincronizando.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k.carregado, k.contratos, k.carros, evento, p.reservas, p.locais]);

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
        <AlertaDeDivergencia alertas={divergenciasDoEvento} />
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
                <LinhaDeEndereco sugestao={ORIGEM_PADRAO} titulo="Local de Origem" comNome nome={evento.origem_rotulo ?? null} conhecidos={conhecidos} valor={evento.origem ?? null} onSalvar={(v, n) => void salvarOrigemPrincipal(v, n)} onAdicionar={() => setAdicionando("origem")} rotuloAdicionar="Adicionar outra origem" testid="linha-origem" />
                {origensExtras.map((l, i) => <LinhaDeEndereco sugestao={ORIGEM_PADRAO} key={l.id} titulo={`Local de Origem ${i + 2}`} comNome nome={l.rotulo} conhecidos={conhecidos} valor={l.endereco} onSalvar={(v, n) => void salvarLocal(l, v, n)} onRemover={() => void p.onRemoverLocal(l).catch(erro)} testid="linha-origem-extra" />)}
                {linhaCampo("contatoOrigem")}
                {locaisDoEvento.length === 0
                  ? <LinhaDeEndereco titulo="Local do Evento" valor={null} comNome conhecidos={conhecidos} onSalvar={(v, n) => { if (v) void p.onAdicionarLocais(evento.id, [{ endereco: v, rotulo: n ?? undefined }]).then(() => preencherContato(campoContato, evento.contato, v)).catch(erro); }} onAdicionar={() => setAdicionando("local")} rotuloAdicionar="Adicionar outro local" testid="linha-local" />
                  : locaisDoEvento.map((l, i) => <LinhaDeEndereco key={l.id} titulo={i === 0 ? "Local do Evento" : `Local do Evento ${i + 1}`} comNome nome={l.rotulo} conhecidos={conhecidos} valor={l.endereco} onSalvar={(v, n) => void salvarLocal(l, v, n)} onAdicionar={i === 0 ? () => setAdicionando("local") : undefined} rotuloAdicionar="Adicionar outro local" onRemover={i === 0 ? undefined : () => void p.onRemoverLocal(l).catch(erro)} testid="linha-local" />)}
                {linhaCampo("contato")}
                <LinhaDeEndereco titulo="Local do Retorno" valor={evento.endereco_retorno ?? null} placeholder="Vazio = volta para a origem" onSalvar={(v) => { if (campoRetorno) void p.onEditarEvento(evento, campoRetorno, v).then(() => preencherContato(campoContatoRetorno, evento.contato_retorno, v)).catch(erro); }} testid="linha-retorno" />
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

            <JanelaDeEndereco sugestao={adicionando === "origem" ? ORIGEM_PADRAO : undefined} aberto={adicionando !== null} titulo={adicionando === "origem" ? "Nova origem" : "Novo local"} valor={null} comNome conhecidos={conhecidos} onFechar={() => setAdicionando(null)}
              onSalvar={(t, n) => { const tipo = adicionando; setAdicionando(null); if (t && tipo) void p.onAdicionarLocais(evento.id, [{ endereco: t, tipo, rotulo: n ?? undefined }]).then(() => (tipo === "local" && locaisDoEvento.length === 0 ? preencherContato(campoContato, evento.contato, t) : undefined)).catch(erro); }} />

            <div><Button variant="danger" icon={<Trash size={18} />} onClick={() => setExcluindo(true)} data-testid="excluir-evento">Excluir evento</Button></div>
          </div>
        )}

        {aba === "veiculos" && (
          <div className="mt-reservas-ed" data-testid="aba-veiculos">
            <div className="ds-stack">
              <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}><h3 className="t-h3">Modelos solicitados</h3><Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={() => setNovoPedido([pedidoVazio()])} data-testid="novo-pedido">Pedir mais modelos</Button></div>
              <TabelaDePedidos recolherReservados pedidos={pedidosDoEvento} atendidos={atendidos} codigoDoCarro={(id) => { const v = p.veiculos.find((x) => x.id === id); return v ? (v.codigo ?? v.modelo.toUpperCase()) : "?"; }} onNaoAtendido={p.onNaoAtendido} onRemover={p.onRemoverDesejado} onNota={p.onNotaDoPedido} onErro={setFalha} />
            </div>
            <VeiculosDoEvento semRetorno={tiposDeEvento.semRetorno(evento.tipo)} onChecklistEmMassa={p.onChecklistEmMassa} onChecklistRetornoEmMassa={p.onChecklistRetornoEmMassa} evento={evento} veiculos={p.veiculos} reservas={p.reservas} reservasSemData={p.reservasSemData} onReservarSemData={p.onReservarSemData} eventos={p.eventos} locais={p.locais} desejados={p.desejados} manutencoes={p.manutencoes} tr={tr}
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
            acoes={contratosDoEvento.length === 0 ? <Button icon={<Plus size={20} />} onClick={() => setNovoContrato(true)} data-testid="novo-contrato">Gerar contrato</Button> : undefined}
            linhas={k.carregado ? contratosDoEvento : null} erro={k.erro} campos={camposC} idDe={(c) => c.id} onEditar={k.editar} onAbrir={(c) => setIdContrato(c.id)}
            rotuloDoTotal={(n) => `${n} contrato${n === 1 ? "" : "s"} deste evento`} placeholderDaBusca="Buscar contrato…"
            vazio={<EmptyState icon={<FileText size={30} />} title="Este evento ainda não tem contrato" action={<Button icon={<Plus size={20} />} onClick={() => setNovoContrato(true)}>Gerar contrato</Button>}>O contrato de comodato nasce deste evento: cliente, vigência e carros vêm do evento, e o DOCX sai pronto do modelo das Configurações.</EmptyState>} />
        )}
      </div>
      <GerarContrato aberto={novoContrato} onFechar={() => setNovoContrato(false)} evento={evento} clientes={clientes} reservas={p.reservas} veiculos={p.veiculos} locais={p.locais} k={k}
        onEscolherCliente={async (id) => { const c = campos.find((x) => x.id === "cliente"); if (c) await p.onEditarEvento(evento, c, id); }} onGerado={(c) => setIdContrato(c.id)} />
      <JanelaDoContrato contrato={contratoAberto} campos={camposC} ctx={ctxCDocs} veiculos={p.veiculos} carrosDoContrato={contratoAberto ? k.carros.filter((c) => c.contrato_id === contratoAberto.id) : []} itens={k.itens} reservasDoEvento={contratoAberto ? (ctxC.reservasDoEvento.get(contratoAberto.evento_id) ?? []) : []}
        onEditar={k.editar} onEditarAditivo={k.editarAditivo} onIncluirCarro={k.incluirCarro} onTirarCarro={k.tirarCarro} onNovoAditivo={k.novoAditivo} onTirarAditivo={k.tirarAditivo}
        onExcluir={async (c) => { await k.excluir(c); setIdContrato(null); }} onFechar={() => setIdContrato(null)} />
      <Sheet open={criandoCliente !== null} onClose={() => setCriandoCliente(null)} title="Novo cliente" wide>
        {criandoCliente !== null && <FormCliente embutido={{ nomeInicial: criandoCliente, onSalvo: (c) => { const campo = campos.find((x) => x.id === "cliente"); setCriandoCliente(null); if (campo) void p.onEditarEvento(evento, campo, c.id).catch((e: Error) => setFalha(e.message)); } }} />}
      </Sheet>
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
