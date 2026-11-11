import { useEffect, useMemo, useState } from "react";
import { Button, DateField, Field, Input, Sheet } from "../../ds";
import { TabelaDoMotor } from "../../components/motor/TabelaDoMotor";
import type { Selecao } from "../../components/motor/CaixaDeSelecao";
import type { CampoDaTela } from "../../components/motor/tipos";
import type { PreferenciasDaTabela } from "../../lib/motor/layout";
import { formatarDiaBr, hojeLocal, somarDias } from "../../lib/motor/datas";
import { atendimentoDosPedidos, combina, pedidoQueAtende, rotuloDoDesejado } from "../../lib/eventos/desejados";
import { SEM_FIM, type Evento, type ModeloDesejado, type Reserva } from "../../lib/eventos/tipos";
import { agendaTexto, conflitos, reservasPorVeiculo, reservavelPeloCiclo } from "../../lib/eventos/uso";
import { manutencoesPorVeiculo, manutencoesQueBloqueiam } from "../../lib/manutencoes/regras";
import type { Manutencao } from "../../lib/manutencoes/tipos";
import { atualizarCampos } from "../../lib/veiculos/dados";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { camposDoVeiculo } from "../veiculos/Veiculos";
import { TabelaDePedidos } from "./TabelaDePedidos";

const COLUNAS = ["codigo", "cor", "my", "statusUso", "agenda", "comentarios"];

/**
 * Reservar carros: um popup grande com as 4 datas do evento no topo, os pedidos de modelo (clique para filtrar os carros que encaixam)
 * e a tabela de carros (Código, Cor, MY, Status de uso, Agenda, Comentários; editável). Também vale o caminho inverso: marque os carros e o
 * evento liga cada um ao pedido que ele atende (a tabela mostra o OK antes de confirmar).
 */
export function AdicionarVeiculos({ aberto, onFechar, evento, veiculos, reservas, eventos, manutencoes = [], pedidos = [], onNaoAtendido, veiculosIniciais, dataInicial, pedidoInicial, onReservar, onReservarSemData }: {
  aberto: boolean; onFechar: () => void; evento: Evento; veiculos: Veiculo[]; reservas: Reserva[]; eventos: Evento[]; manutencoes?: Manutencao[];
  /** O que o evento pediu (modelos desejados). */ pedidos?: ModeloDesejado[]; onNaoAtendido?: (id: string, naoAtendido: boolean) => Promise<void>;
  /** Carros já marcados ao abrir (ex.: o carro em que a pessoa deu duplo clique) e a data de chegada sugerida. */ veiculosIniciais?: string[]; dataInicial?: string | null;
  /** Pedido já escolhido ao abrir (veio da linha "Definir carro"). */ pedidoInicial?: string | null;
  /** Põe os carros marcados no evento SEM data (as datas entram depois). */ onReservarSemData?: (veiculoIds: string[], pedidoId?: string) => Promise<void>;
  onReservar: (veiculoIds: string[], inicio: string, fim: string, janela: { chegada: string; retirada: string }, pedidoId?: string) => Promise<void>;
}) {
  // as datas vêm do evento (travadas); sem data no evento, dá para preencher aqui
  const [envio, setEnvio] = useState(evento.envio_previsto ?? "");
  const [chegada, setChegada] = useState(evento.chegada_prevista ?? somarDias(hojeLocal(), 2));
  const [retirada, setRetirada] = useState(evento.retirada_prevista ?? somarDias(hojeLocal(), 4));
  const [retorno, setRetorno] = useState(evento.retorno_previsto ?? "");
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [pedidoSel, setPedidoSel] = useState<string | null>(null);
  const [soLivres, setSoLivres] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [edits, setEdits] = useState<Map<string, Veiculo>>(new Map());
  const [prefs, setPrefs] = useState<PreferenciasDaTabela>({});

  useEffect(() => {
    if (!aberto) return;
    setMarcados(new Set(veiculosIniciais ?? [])); setPedidoSel(pedidoInicial ?? null); setErro(null);
    const c = evento.chegada_prevista ?? dataInicial;
    setEnvio(evento.envio_previsto ?? ""); setRetorno(evento.retorno_previsto ?? "");
    if (c) { setChegada(c); setRetirada(evento.retirada_prevista ?? somarDias(c, 2)); } else { setChegada(somarDias(hojeLocal(), 2)); setRetirada(evento.retirada_prevista ?? somarDias(hojeLocal(), 4)); }
  }, [aberto, veiculosIniciais, dataInicial, pedidoInicial, evento.chegada_prevista, evento.retirada_prevista, evento.envio_previsto, evento.retorno_previsto]);

  const todos = useMemo(() => veiculos.map((v) => edits.get(v.id) ?? v), [veiculos, edits]);
  const porCarro = useMemo(() => reservasPorVeiculo(reservas), [reservas]);
  const oficina = useMemo(() => manutencoesPorVeiculo(manutencoes), [manutencoes]);
  const nomes = useMemo(() => new Map(eventos.map((e) => [e.id, e.nome])), [eventos]);
  const doEvento = useMemo(() => reservas.filter((r) => r.evento_id === evento.id && r.estado !== "cancelado"), [reservas, evento.id]);
  const jaNoEvento = useMemo(() => new Set(doEvento.map((r) => r.veiculo_id)), [doEvento]);
  // sem data de retirada o carro fica reservado em aberto (evento contínuo, sem volta)
  const periodoOk = !!chegada && (!retirada || retirada >= chegada) && (!envio || envio <= chegada) && (!retorno || !retirada || retorno >= retirada);
  const inicio = envio || chegada, fim = retorno || retirada || SEM_FIM;

  const pedidosDoEvento = useMemo(() => pedidos.filter((p) => p.evento_id === evento.id), [pedidos, evento.id]);
  const mapaDeVeiculos = useMemo(() => new Map(todos.map((v) => [v.id, v])), [todos]);
  const atendidos = useMemo(() => atendimentoDosPedidos(pedidosDoEvento, doEvento, mapaDeVeiculos), [pedidosDoEvento, doEvento, mapaDeVeiculos]);
  const abertos = useMemo(() => pedidosDoEvento.filter((p) => !p.reserva_id && !p.nao_atendido && !atendidos.has(p.id)), [pedidosDoEvento, atendidos]);
  const selecionado = abertos.find((p) => p.id === pedidoSel) ?? null;
  const codigoDe = (id: string) => { const v = mapaDeVeiculos.get(id); return v ? (v.codigo ?? v.modelo.toUpperCase()) : "?"; };

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return todos
      .filter((v) => reservavelPeloCiclo(v.status_ciclo) && !jaNoEvento.has(v.id))
      .filter((v) => !selecionado || marcados.has(v.id) || combina(v, selecionado))
      .filter((v) => !q || `${v.codigo ?? ""} ${v.modelo} ${v.placa ?? ""} ${v.cor ?? ""} ${v.comentarios ?? ""}`.toLowerCase().includes(q))
      .map((v) => {
        const r = porCarro.get(v.id) ?? [];
        const choques = periodoOk ? conflitos({ inicio, fim }, r, evento.id) : [];
        const noConserto = periodoOk ? manutencoesQueBloqueiam({ inicio, fim }, oficina.get(v.id) ?? []) : [];
        return { v, choques, noConserto };
      })
      .filter((l) => !soLivres || marcados.has(l.v.id) || (l.choques.length === 0 && l.noConserto.length === 0))
      .sort((a, b) => Number(a.choques.length + a.noConserto.length > 0) - Number(b.choques.length + b.noConserto.length > 0) || (a.v.codigo ?? a.v.modelo).localeCompare(b.v.codigo ?? b.v.modelo, "pt-BR", { numeric: true }));
  }, [todos, busca, jaNoEvento, porCarro, oficina, periodoOk, inicio, fim, evento.id, selecionado, soLivres, marcados]);

  // o que cada carro MARCADO atende (na ordem da tabela): o pedido escolhido tem prioridade
  const previsao = useMemo(() => {
    const m = new Map<string, string>(); let livres = abertos;
    for (const { v } of linhas) {
      if (!marcados.has(v.id)) continue;
      const alvo = (selecionado && livres.find((p) => p.id === selecionado.id && combina(v, p))) || pedidoQueAtende(v, livres);
      if (alvo) { m.set(alvo.id, v.id); livres = livres.filter((p) => p.id !== alvo.id); }
    }
    return m;
  }, [linhas, marcados, abertos, selecionado]);
  const pedidoDoCarro = useMemo(() => new Map([...previsao].map(([p, v]) => [v, pedidosDoEvento.find((x) => x.id === p)!])), [previsao, pedidosDoEvento]);

  const ctx = useMemo(() => ({ reservas: porCarro, nomeDoEvento: (id: string) => nomes.get(id) ?? "?", carregado: true, hoje: hojeLocal(), manutencoes: oficina }), [porCarro, nomes, oficina]);
  const campos = useMemo<CampoDaTela<Veiculo>[]>(() => {
    const base = camposDoVeiculo(ctx);
    const doPadrao = COLUNAS.map((id) => ({ ...base.find((c) => c.id === id)!, padrao: true }));
    const avisoDe = (v: Veiculo) => { const l = linhas.find((x) => x.v.id === v.id); if (!l) return ""; const t: string[] = []; if (l.noConserto.length) t.push(`Manutenção: ${l.noConserto.map((m) => m.nome).join(", ")}`); if (l.choques.length) t.push(`Reservado: ${agendaTexto(l.choques, (id) => nomes.get(id) ?? "?", hojeLocal())}`); return t.join(" · "); };
    return [
      ...doPadrao,
      { id: "pedido", titulo: "Pedido", tipo: "texto", valorDe: (v) => { const p = pedidoDoCarro.get(v.id); return p ? rotuloDoDesejado(p) : null; }, celula: (v) => { const p = pedidoDoCarro.get(v.id); return p ? <span className="mt-ped__status is-reservado">OK · {rotuloDoDesejado(p)}</span> : <span className="mt-vazio">—</span>; }, largura: 240, padrao: true },
      { id: "conflito", titulo: "Conflito no período", tipo: "texto", valorDe: (v) => avisoDe(v) || null, celula: (v) => { const a = avisoDe(v); return a ? <span style={{ color: "var(--color-warning-fg)" }} title={a}>⚠ {a}</span> : <span className="mt-vazio">—</span>; }, largura: 280, padrao: true },
    ];
  }, [ctx, linhas, pedidoDoCarro, nomes]);

  const selecao = useMemo<Selecao>(() => ({
    ids: marcados,
    alternar: (id) => setMarcados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
    alternarVarios: (ids, marcar) => setMarcados((s) => { const n = new Set(s); for (const id of ids) { if (marcar) n.add(id); else n.delete(id); } return n; }),
    definir: (ids) => setMarcados(new Set(ids)),
  }), [marcados]);
  const comConflito = linhas.filter((l) => marcados.has(l.v.id) && (l.choques.length > 0 || l.noConserto.length > 0)).length;

  async function reservarSemData() {
    if (!onReservarSemData) return;
    setErro(null); setEnviando(true);
    try { await onReservarSemData([...marcados], selecionado?.id); setMarcados(new Set()); onFechar(); } catch (e) { setErro((e as Error).message); } finally { setEnviando(false); }
  }
  async function reservar() {
    setErro(null); setEnviando(true);
    try { await onReservar([...marcados], inicio, fim, { chegada, retirada }, selecionado?.id); setMarcados(new Set()); onFechar(); } catch (e) { setErro((e as Error).message); } finally { setEnviando(false); }
  }
  const dataDoEvento = (v: string | null | undefined) => !!v;

  return (
    <Sheet open={aberto} onClose={onFechar} title="Reservar carros" wide>
      <div className="ds-stack mt-reservar" data-testid="adicionar-veiculos">
        <p className="t-body-sm t-muted">Evento: <b>{evento.nome}</b>. As datas vêm do evento (para mudar, edite a aba Dados do evento); a reserva de cada carro vai do envio ao retorno.</p>
        <div className="mt-reservar__datas">
          <Field label="Data de envio"><DateField value={envio} onChange={(e) => setEnvio(e.target.value)} disabled={dataDoEvento(evento.envio_previsto)} /></Field>
          <Field label="Data de chegada"><DateField value={chegada} onChange={(e) => setChegada(e.target.value)} disabled={dataDoEvento(evento.chegada_prevista)} /></Field>
          <Field label="Data de retirada" error={chegada && retirada && retirada < chegada ? "Antes da chegada." : null}><DateField value={retirada} onChange={(e) => setRetirada(e.target.value)} disabled={dataDoEvento(evento.retirada_prevista)} /></Field>
          <Field label="Data do retorno"><DateField value={retorno} onChange={(e) => setRetorno(e.target.value)} disabled={dataDoEvento(evento.retorno_previsto)} /></Field>
        </div>
        {periodoOk && <p className="t-body-sm" data-testid="periodo-reserva">Reserva do carro: <b>{formatarDiaBr(inicio)} {fim === SEM_FIM ? "em diante (sem data de retirada: reserva em aberto)" : `a ${formatarDiaBr(fim)}`}</b>.</p>}
        {pedidosDoEvento.length > 0 && <TabelaDePedidos pedidos={pedidosDoEvento} atendidos={atendidos} previsao={previsao} codigoDoCarro={codigoDe} selecionadoId={selecionado?.id ?? null} onSelecionar={setPedidoSel} onNaoAtendido={onNaoAtendido} onErro={setErro} />}
        <div className="ds-row" style={{ flexWrap: "wrap", gap: 16 }}>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar carro (código, modelo, placa, cor, comentário)…" aria-label="Buscar carro para reservar" style={{ maxWidth: 420 }} />
          <label className="ds-row" style={{ gap: 6 }}><input type="checkbox" checked={soLivres} onChange={(e) => setSoLivres(e.target.checked)} data-testid="so-livres" /><span className="t-body-sm">Só disponíveis no período</span></label>
          {selecionado && <span className="t-body-sm">Mostrando os carros que encaixam em <b>{rotuloDoDesejado(selecionado)}</b> <Button type="button" size="sm" variant="ghost" onClick={() => setPedidoSel(null)}>Ver todos</Button></span>}
        </div>
        <div className="mt-reservar__tabela">
          <TabelaDoMotor<Veiculo> linhas={linhas.map((l) => l.v)} campos={campos} prefs={prefs} onPrefs={setPrefs} idDe={(v) => v.id} selecao={selecao}
            onEditar={async (v, campo, valor) => { const novo = await atualizarCampos(v.id, { [campo.edicao!.coluna]: valor } as Partial<Veiculo>); setEdits((m) => new Map(m).set(v.id, novo)); }}
            rotuloDoTotal={(n) => `${n} carro${n === 1 ? "" : "s"}`}
            vazio={<p className="t-body t-muted" style={{ padding: 16 }}>Nenhum carro para escolher. {selecionado || soLivres ? "Tire um filtro (pedido escolhido ou “Só disponíveis”)." : ""}</p>} />
        </div>
        {comConflito > 0 && <p className="t-body-sm" style={{ color: "var(--color-warning-fg)" }}>{comConflito} carro{comConflito === 1 ? "" : "s"} marcado{comConflito === 1 ? "" : "s"} já tem{comConflito === 1 ? "" : "m"} reserva ou manutenção nesse período. Dá para reservar mesmo assim (troca de carro é comum).</p>}
        {erro && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{erro}</p>}
        <div className="mt-reservar__rodape">
          {onReservarSemData && <Button size="lg" variant="secondary" disabled={marcados.size === 0} loading={enviando} onClick={() => void reservarSemData()} data-testid="reservar-sem-data">Adicionar {marcados.size || ""} carro{marcados.size === 1 ? "" : "s"} sem data</Button>}
          <Button size="lg" disabled={marcados.size === 0 || !periodoOk} loading={enviando} onClick={() => void reservar()} data-testid="confirmar-reserva">
            Reservar {marcados.size} carro{marcados.size === 1 ? "" : "s"}{periodoOk ? (fim === SEM_FIM ? ` · desde ${formatarDiaBr(inicio).slice(0, 5)}` : ` · ${formatarDiaBr(inicio).slice(0, 5)} a ${formatarDiaBr(fim).slice(0, 5)}`) : ""}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

