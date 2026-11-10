import { BotoesDeCopia } from "./BotoesDeCopia";
import { useVersaoDosDados } from "../../lib/sincronia";
import { LinkNoLugar, useAbrirNoLugar } from "../../app/noLugar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowsClockwise, Plus, Table, Car } from "@phosphor-icons/react";
import { Button, Card, EmptyState, useToast } from "../../ds";
import { usePopover } from "../../ds/popover";
import type { ConfigDeChips } from "../../components/motor/ChipsRapidos";
import { TelaDoMotor } from "../../components/motor/TelaDoMotor";
import { JanelaDoVeiculo } from "./JanelaDoVeiculo";
import { NovoVeiculo } from "./NovoVeiculo";
import { AcoesDosVeiculosSelecionados } from "./AcoesDosVeiculosSelecionados";
import { hojeLocal } from "../../lib/motor/datas";
import { atualizarReserva } from "../../lib/eventos/dados";
import { barrasDoVeiculo } from "../../lib/eventos/barras";
import { aplicarArrasto, diferencas, reajustarReserva } from "../../lib/linhaDoTempo/arrasto";
import type { ModoDeArrasto, Barra } from "../../lib/linhaDoTempo/tipos";
import type { Evento, Reserva } from "../../lib/eventos/tipos";
import { barrasDeManutencao, ehBarraDeManutencao } from "../../lib/manutencoes/barras";
import type { Manutencao } from "../../lib/manutencoes/tipos";
import { useDadosDeEventos } from "../eventos/useDadosDeEventos";
import { useCriacaoNaLinha } from "../planejamento/useCriacaoNaLinha";
import { anotacoesPorVeiculo, barrasDeAnotacao, ehBarraDeAnotacao } from "../../lib/veiculos/anotacoes";
import { AgendaEmTags } from "./AgendaEmTags";
import { Tag } from "../../components/motor/Tag";
import { STATUS_DE_USO, agendaItens, agendaTexto, reservasPorVeiculo, statusDeUso } from "../../lib/eventos/uso";
import type { OnEditar } from "../../components/motor/useEdicao";
import type { CampoDaTela, OpcaoDoCampo } from "../../components/motor/tipos";
import { atualizarCampos, listarVeiculos } from "../../lib/veiculos/dados";
import { partirModelo } from "../../lib/veiculos/modelo";
import { avisoDoCicloAutomatico } from "../../lib/veiculos/ciclo";
import { CICLO, SEGURO, normalizarPlaca, normalizarVin, placaValida, vinValido, type Veiculo } from "../../lib/veiculos/tipos";
import "../veiculos/veiculos.css";

const dia = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
const TOM_CICLO: Record<string, OpcaoDoCampo["tom"]> = { pedido_recebido: "neutral", liberado: "info", em_transporte_0km: "info", disponivel_sem_faturamento: "warning", revisao_emplacamento: "warning", em_blindagem: "accent", disponivel: "success", gravame: "error", venda_vip: "accent", em_devolucao: "warning", devolvido: "neutral" };
const OPCOES_CICLO: OpcaoDoCampo[] = CICLO.map((c) => ({ value: c.value, label: c.label, tom: TOM_CICLO[c.value] ?? "neutral" }));
const OPCOES_SEGURO: OpcaoDoCampo[] = SEGURO.map((s) => ({ value: s.value, label: s.label, tom: s.value === "cadastrado" ? "success" : s.value === "cancelado" ? "error" : "warning" }));

/** Os campos de veículo: o que a consulta filtra/ordena/agrupa e o que a tabela mostra. Os não marcados `padrao:false` começam visíveis. */
/** O que os campos calculados (Status de uso, Agenda) precisam saber: as reservas de cada carro. `carregado: false` = ainda sem as tabelas de eventos. */
export type ContextoDeUso = { reservas: Map<string, Reserva[]>; nomeDoEvento: (id: string) => string; carregado: boolean; hoje: string; manutencoes?: Map<string, Manutencao[]> };
const SEM_USO: ContextoDeUso = { reservas: new Map(), nomeDoEvento: () => "?", carregado: false, hoje: "" };
const TOM_USO = Object.fromEntries(STATUS_DE_USO.map((u) => [u.value, u.tom])) as Record<string, OpcaoDoCampo["tom"]>;
const OPCOES_USO: OpcaoDoCampo[] = STATUS_DE_USO.map((u) => ({ value: u.value, label: u.label, tom: TOM_USO[u.value] }));

/** Os campos de veículo. Status de uso e Agenda são CALCULADOS das reservas (só leitura); o resto se edita no lugar. */
export const camposDoVeiculo = (ctx: ContextoDeUso): CampoDaTela<Veiculo>[] => [
  { id: "codigo", titulo: "Código", tipo: "texto", valorDe: (v) => v.codigo ?? v.modelo.toUpperCase(), largura: 180, fixa: true },
  { id: "placa", titulo: "Placa", tipo: "texto", valorDe: (v) => v.placa, largura: 110, edicao: { coluna: "placa", maxLength: 8, placeholder: "ABC1D23", normalizar: normalizarPlaca, validar: (t) => (placaValida(t) ? null : "A placa tem 7 caracteres.") } },
  { id: "statusUso", titulo: "Status de uso", tipo: "opcao", valorDe: (v) => (ctx.carregado ? statusDeUso(ctx.reservas.get(v.id) ?? [], ctx.manutencoes?.get(v.id) ?? [], ctx.hoje) : null), opcoes: OPCOES_USO, rotuloDoValor: (x) => OPCOES_USO.find((o) => o.value === x)?.label ?? x, ordemDoValor: (x) => STATUS_DE_USO.findIndex((u) => u.value === x), largura: 150 },
  { id: "agenda", titulo: "Agenda", tipo: "texto", valorDe: (v) => (ctx.carregado ? agendaTexto(ctx.reservas.get(v.id) ?? [], ctx.nomeDoEvento, ctx.hoje, ctx.manutencoes?.get(v.id) ?? []) || null : null), multilinha: true, largura: 420,
    celula: (v) => <AgendaEmTags itens={ctx.carregado ? agendaItens(ctx.reservas.get(v.id) ?? [], ctx.nomeDoEvento, ctx.hoje, ctx.manutencoes?.get(v.id) ?? []) : []} /> },
  { id: "vin", titulo: "VIN (chassi)", tipo: "texto", valorDe: (v) => v.vin, largura: 190, edicao: { coluna: "vin", maxLength: 20, placeholder: "17 caracteres", normalizar: normalizarVin, validar: (t) => (vinValido(t) ? null : "O VIN tem 17 letras e números.") } },
  { id: "modelo", titulo: "Modelo", tipo: "texto", valorDe: (v) => v.modelo, largura: 160, padrao: false, edicao: { coluna: "modelo", obrigatorio: true } },
  { id: "cor", titulo: "Cor", tipo: "texto", valorDe: (v) => v.cor, largura: 130, edicao: { coluna: "cor" } },
  { id: "my", titulo: "MY", tipo: "texto", valorDe: (v) => v.my, largura: 90, edicao: { coluna: "my", maxLength: 9 } },
  { id: "pedido", titulo: "Pedido", tipo: "texto", valorDe: (v) => v.pedido, largura: 140, padrao: false, edicao: { coluna: "pedido" } },
  { id: "ciclo", titulo: "Ciclo de vida", tipo: "opcao", valorDe: (v) => v.status_ciclo, opcoes: OPCOES_CICLO, rotuloDoValor: (x) => OPCOES_CICLO.find((o) => o.value === x)?.label ?? x, ordemDoValor: (x) => CICLO.findIndex((c) => c.value === x), largura: 210, edicao: { coluna: "status_ciclo", obrigatorio: true } },
  { id: "seguro", titulo: "Seguro", tipo: "opcao", valorDe: (v) => v.seguro_status, opcoes: OPCOES_SEGURO, rotuloDoValor: (x) => OPCOES_SEGURO.find((o) => o.value === x)?.label ?? x, ordemDoValor: (x) => SEGURO.findIndex((s) => s.value === x), largura: 130, edicao: { coluna: "seguro_status", obrigatorio: true } },
  { id: "blindado", titulo: "Blindado", tipo: "caixa", valorDe: (v) => v.blindado, largura: 110, padrao: false, edicao: { coluna: "blindado" } },
  { id: "pedidoEm", titulo: "Pedido recebido em", tipo: "data", valorDe: (v) => v.data_pedido, largura: 200, padrao: false, edicao: { coluna: "data_pedido" } },
  { id: "liberadoEm", titulo: "Liberado em", tipo: "data", valorDe: (v) => v.data_liberacao, largura: 170, padrao: false, edicao: { coluna: "data_liberacao" } },
  { id: "faturadoEm", titulo: "Faturado em", tipo: "data", valorDe: (v) => v.data_faturamento, largura: 170, padrao: false, edicao: { coluna: "data_faturamento" } },
  { id: "emplacadoEm", titulo: "Emplacado em", tipo: "data", valorDe: (v) => v.data_emplacamento, largura: 170, padrao: false, edicao: { coluna: "data_emplacamento" } },
  { id: "devolvidoEm", titulo: "Devolvido em", tipo: "data", valorDe: (v) => v.data_devolucao, largura: 170, padrao: false, edicao: { coluna: "data_devolucao" } },
  { id: "comentarios", titulo: "Comentários", tipo: "texto", valorDe: (v) => v.comentarios, largura: 280, padrao: false, edicao: { coluna: "comentarios" } },
  { id: "cadastradoEm", titulo: "Cadastrado em", tipo: "data", valorDe: (v) => dia(v.created_at), largura: 170, padrao: false },
];


export function Veiculos() {
  const navigate = useNavigate();
  const abrirNoLugar = useAbrirNoLugar();
  const toast = useToast();
  const { id: idAberto } = useParams<{ id?: string }>();
  const [lista, setLista] = useState<Veiculo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // eventos, reservas, manutenções, anotações e as ações sobre eles: os mesmos do Planejamento
  const d = useDadosDeEventos();
  const criacao = useCriacaoNaLinha(d);
  const [busca, setBusca] = useSearchParams();
  const [novo, setNovo] = useState(busca.get("novo") === "1");   // /veiculos/novo (link antigo) abre a janela
  useEffect(() => { if (busca.get("novo")) { const b = new URLSearchParams(busca); b.delete("novo"); setBusca(b, { replace: true }); } }, [busca, setBusca]);
  const reservas = d.eventos ? d.reservas : null;
  const eventos = d.eventos ?? [];
  const erroUso = d.erro;
  const man = { doCarro: d.manutencoesDoCarro, mover: d.moverManutencao, criar: d.criarDeManutencao, erro: null as string | null };
  const clientesPorId = useMemo(() => new Map(d.clientes.map((c) => [c.id, c.nome])), [d.clientes]);
  const notasPorCarro = useMemo(() => anotacoesPorVeiculo(d.anotacoes), [d.anotacoes]);

  const versao = useVersaoDosDados();
  useEffect(() => { listarVeiculos().then(setLista, (e: Error) => setErro(e.message)); }, [versao]);

  const ctx = useMemo<ContextoDeUso>(() => {
    if (!d.eventos) return SEM_USO;
    const nomes = new Map(eventos.map((e) => [e.id, e.nome]));
    return { reservas: reservasPorVeiculo(d.reservas), nomeDoEvento: (id) => nomes.get(id) ?? "?", carregado: true, hoje: hojeLocal(), manutencoes: man.doCarro };
  }, [d.reservas, d.eventos, eventos, man.doCarro]);
  const campos = useMemo(() => camposDoVeiculo(ctx), [ctx]);

  const editar: OnEditar<Veiculo> = async (linha, campo, valor) => {
    const novo = await atualizarCampos(linha.id, { [campo.edicao!.coluna]: valor } as Partial<Veiculo>);
    setLista((l) => (l ?? []).map((x) => (x.id === linha.id ? novo : x)));
    const aviso = avisoDoCicloAutomatico(linha, novo, campo.edicao!.coluna);
    if (aviso) toast(aviso);
  };
  /** Arrastar uma barra de reserva na linha do tempo muda as datas da reserva (mover leva chegada e retirada junto). */
  const alterarReserva = async (_v: Veiculo, barra: Barra, modo: ModoDeArrasto, delta: number) => {
    if (ehBarraDeManutencao(barra)) { await man.mover(barra.id, modo, delta); return; }
    if (ehBarraDeAnotacao(barra)) { const n = aplicarArrasto({ inicio: barra.inicio, fim: barra.fim }, modo, delta); await d.moverNota(barra.id, n.inicio, n.fim); return; }
    const r = reservas?.find((x) => x.id === barra.id); if (!r) return;
    const dif = diferencas(r, reajustarReserva(r, modo, delta));
    if (Object.keys(dif).length === 0) return;
    const salva = await atualizarReserva(r.id, dif);
    d.setReservas((l) => l.map((x) => (x.id === r.id ? salva : x)));
  };
  const aberto = idAberto && lista ? (lista.find((x) => x.id === idAberto) ?? null) : null;
  useEffect(() => { if (idAberto && lista && !lista.some((x) => x.id === idAberto)) navigate("/veiculos", { replace: true }); }, [idAberto, lista, navigate]);

  return (
    <>
    <TelaDoMotor<Veiculo> tela="veiculos" extrasDaPrimeira={(ls) => <BotoesDeCopia veiculos={ls} />} acoesDaSelecao={({ ids, limpar }) => <AcoesDosVeiculosSelecionados d={d} ids={ids} limpar={limpar} />} chipsRapidos={CHIPS_POR_MODELO} titulo="Veículos" subtitulo="Todos os carros, do pedido à devolução."
      acoes={<NovoMenu aoNovo={() => setNovo(true)} />}
      avisos={erroUso && <Card><p className="t-body-sm" role="alert" data-testid="aviso-uso">Status de uso e Agenda ainda não funcionam: {erroUso}</p></Card>}
      linhas={lista} erro={erro} campos={campos} idDe={(x) => x.id} onEditar={editar} onAbrir={(x) => navigate(`/veiculos/${x.id}`)}
      linhaDoTempo={{ barrasDe: (v) => [...barrasDoVeiculo(ctx.reservas.get(v.id) ?? [], ctx.nomeDoEvento), ...barrasDeManutencao(man.doCarro.get(v.id) ?? [], ctx.hoje || hojeLocal()), ...barrasDeAnotacao(notasPorCarro.get(v.id) ?? [])], onAlterarBarra: alterarReserva, onCriarNaData: (v, data) => criacao.abrirNoDia(v.id, data),
        onAbrirBarra: (_v, b) => { if (ehBarraDeAnotacao(b)) { criacao.editarNota(b.id); return; } abrirNoLugar(ehBarraDeManutencao(b) ? `/manutencoes/${b.id}` : `/eventos/${(b.dados as { eventoId: string }).eventoId}`); } }}
      rotuloDoTotal={(n) => `${n} veículo${n === 1 ? "" : "s"}`} placeholderDaBusca="Buscar placa, VIN, modelo…"
      vazio={<EmptyState icon={<Car size={30} />} title="Nenhum veículo ainda" action={<Button icon={<Plus size={20} />} onClick={() => setNovo(true)}>Cadastrar o primeiro</Button>}>Cadastre um por um ou cole a tabela do Excel em <Link to="/veiculos/massa">Importar em massa</Link>.</EmptyState>}
      filhos={<JanelaDoVeiculo reservasSemData={aberto ? d.reservasSemData.filter((r) => r.veiculo_id === aberto.id) : []} clientes={clientesPorId} locais={d.locais} veiculo={aberto} campos={campos} onEditar={editar} onFechar={() => navigate("/veiculos")} reservas={aberto ? (ctx.reservas.get(aberto.id) ?? []) : []} eventos={eventos} usoCarregado={ctx.carregado} manutencoes={aberto ? (man.doCarro.get(aberto.id) ?? []) : []} manutencoesErro={man.erro} onCriarManutencao={man.criar} />} />
    {criacao.dialogos}
    <NovoVeiculo aberto={novo} onFechar={() => setNovo(false)} onCriado={(v) => setLista((l) => [v, ...(l ?? [])])} />
    </>
  );
}

const CHIPS_POR_MODELO: ConfigDeChips<Veiculo> = {
  id: "por-modelo", rotulo: "Por modelo", semValor: "Sem modelo",
  niveis: [{ rotulo: "Modelo", valorDe: (v) => partirModelo(v.modelo).mae }, { rotulo: "Versão", valorDe: (v) => partirModelo(v.modelo).versao }],
};

/** Botão único "Novo": pergunta se é um veículo ou uma importação em massa. */
function NovoMenu({ aoNovo }: { aoNovo: () => void }) {
  const gatilho = useRef<HTMLSpanElement>(null);
  const { ref, aberto, setAberto } = usePopover(gatilho, { largura: 240 });
  const navigate = useNavigate();
  const ir = (p: string) => { setAberto(false); navigate(p); };
  return (
    <span ref={gatilho} style={{ display: "inline-flex" }}>
      <Button icon={<Plus size={20} />} onClick={() => setAberto(!aberto)} aria-haspopup="menu" aria-expanded={aberto} data-testid="novo-menu">Novo</Button>
      <div ref={ref} popover="auto" role="menu" className="ds-pop" data-testid="novo-menu-lista">
        <button type="button" role="menuitem" className="ds-pop__opcao" style={{ width: "100%", border: 0, background: "transparent", color: "inherit", font: "inherit" }} onClick={() => { setAberto(false); aoNovo(); }}><span>Adicionar novo veículo</span><Plus size={18} /></button>
        <button type="button" role="menuitem" className="ds-pop__opcao" style={{ width: "100%", border: 0, background: "transparent", color: "inherit", font: "inherit" }} onClick={() => ir("/veiculos/massa")}><span>Importar em massa</span><Table size={18} /></button>
        <button type="button" role="menuitem" className="ds-pop__opcao" style={{ width: "100%", border: 0, background: "transparent", color: "inherit", font: "inherit" }} onClick={() => ir("/lancamentos")}><span>Lançamentos em massa</span><ArrowsClockwise size={18} /></button>
      </div>
    </span>
  );
}
