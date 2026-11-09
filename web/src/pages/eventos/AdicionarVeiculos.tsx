import { useEffect, useMemo, useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { Button, DateField, Field, Input, Sheet } from "../../ds";
import { Tag } from "../../components/motor/Tag";
import { formatarDiaBr, hojeLocal, somarDias } from "../../lib/motor/datas";
import { periodoDaReserva } from "../../lib/eventos/barras";
import { cabeNosPedidos } from "../../lib/eventos/desejados";
import type { Evento, ModeloDesejado, Reserva } from "../../lib/eventos/tipos";
import { PedidosDoEvento } from "./PedidosDoEvento";
import { STATUS_DE_USO, agendaTexto, conflitos, reservasPorVeiculo, statusDeUso } from "../../lib/eventos/uso";
import { manutencoesPorVeiculo, manutencoesQueBloqueiam } from "../../lib/manutencoes/regras";
import type { Manutencao } from "../../lib/manutencoes/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";

/** Escolher carros para o evento: período, busca e, para cada carro, o status de uso e o AVISO de conflito com outras reservas. */
export function AdicionarVeiculos({ aberto, onFechar, evento, veiculos, reservas, eventos, manutencoes = [], pedidos = [], onNaoAtendido, veiculosIniciais, dataInicial, onReservar }: {
  aberto: boolean; onFechar: () => void; evento: Evento; veiculos: Veiculo[]; reservas: Reserva[]; eventos: Evento[]; manutencoes?: Manutencao[];
  /** O que o evento pediu (modelos desejados): filtra os carros e mostra o cadeado. */ pedidos?: ModeloDesejado[]; onNaoAtendido?: (id: string, naoAtendido: boolean) => Promise<void>;
  /** Carros já marcados ao abrir (ex.: o carro em que a pessoa deu duplo clique) e a data de chegada sugerida. */ veiculosIniciais?: string[]; dataInicial?: string | null;
  onReservar: (veiculoIds: string[], inicio: string, fim: string, janela: { chegada: string; retirada: string }) => Promise<void>;
}) {
  const [chegada, setChegada] = useState(evento.chegada_prevista ?? somarDias(hojeLocal(), 2));
  const [retirada, setRetirada] = useState(evento.retirada_prevista ?? somarDias(hojeLocal(), 4));
  const [diasIda, setDiasIda] = useState("0");
  const [diasVolta, setDiasVolta] = useState("0");
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [soPedido, setSoPedido] = useState(true);
  const [soLivres, setSoLivres] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setMarcados(new Set(veiculosIniciais ?? []));
    const c = evento.chegada_prevista ?? dataInicial; if (c) { setChegada(c); setRetirada(evento.retirada_prevista ?? somarDias(c, 2)); }
  }, [aberto, veiculosIniciais, dataInicial, evento.chegada_prevista, evento.retirada_prevista]);

  const porCarro = useMemo(() => reservasPorVeiculo(reservas), [reservas]);
  const oficina = useMemo(() => manutencoesPorVeiculo(manutencoes), [manutencoes]);
  const nomes = useMemo(() => new Map(eventos.map((e) => [e.id, e.nome])), [eventos]);
  const jaNoEvento = useMemo(() => new Set(reservas.filter((r) => r.evento_id === evento.id && r.estado !== "cancelado").map((r) => r.veiculo_id)), [reservas, evento.id]);
  const periodoOk = !!chegada && !!retirada && retirada >= chegada;
  const { inicio, fim } = periodoOk ? periodoDaReserva(chegada, retirada, Number(diasIda) || 0, Number(diasVolta) || 0) : { inicio: chegada, fim: retirada };

  const pedidosDoEvento = useMemo(() => pedidos.filter((p) => p.evento_id === evento.id), [pedidos, evento.id]);
  const temPedidoAberto = pedidosDoEvento.some((p) => !p.reserva_id && !p.nao_atendido);
  const codigoDaReserva = (reservaId: string) => { const r = reservas.find((x) => x.id === reservaId); const v = r && veiculos.find((x) => x.id === r.veiculo_id); return v ? (v.codigo ?? v.modelo.toUpperCase()) : null; };
  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return veiculos
      .filter((v) => v.status_ciclo !== "devolvido" && !jaNoEvento.has(v.id))
      .filter((v) => !soPedido || marcados.has(v.id) || cabeNosPedidos(v, pedidosDoEvento))
      .filter((v) => !q || `${v.codigo ?? ""} ${v.modelo} ${v.placa ?? ""} ${v.cor ?? ""}`.toLowerCase().includes(q))
      .map((v) => {
        const r = porCarro.get(v.id) ?? [];
        const choques = periodoOk ? conflitos({ inicio, fim }, r, evento.id) : [];
        const noConserto = periodoOk ? manutencoesQueBloqueiam({ inicio, fim }, oficina.get(v.id) ?? []) : [];
        return { v, uso: statusDeUso(r, oficina.get(v.id) ?? [], hojeLocal()), choques, noConserto };
      })
      .filter((l) => !soLivres || marcados.has(l.v.id) || (l.choques.length === 0 && l.noConserto.length === 0))
      .sort((a, b) => Number(a.choques.length + a.noConserto.length > 0) - Number(b.choques.length + b.noConserto.length > 0) || (a.v.codigo ?? a.v.modelo).localeCompare(b.v.codigo ?? b.v.modelo, "pt-BR", { numeric: true }));
  }, [veiculos, busca, jaNoEvento, porCarro, oficina, periodoOk, inicio, fim, evento.id, soPedido, soLivres, pedidosDoEvento, marcados]);

  const alterna = (id: string) => setMarcados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const comConflito = linhas.filter((l) => marcados.has(l.v.id) && (l.choques.length > 0 || l.noConserto.length > 0)).length;

  async function reservar() {
    setErro(null); setEnviando(true);
    try { await onReservar([...marcados], inicio, fim, { chegada, retirada }); setMarcados(new Set()); onFechar(); } catch (e) { setErro((e as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title="Reservar carros">
      <div className="ds-stack" data-testid="adicionar-veiculos">
        <p className="t-body-sm t-muted">Evento: <b>{evento.nome}</b>. Informe quando os carros chegam e quando saem; a logística (dias de estrada) vem antes e depois.</p>
        <div className="vei-form__linha">
          <Field label="Chegada dos carros"><DateField value={chegada} onChange={(e) => setChegada(e.target.value)} /></Field>
          <Field label="Retirada dos carros" error={chegada && retirada && retirada < chegada ? "A retirada não pode ser antes da chegada." : null}><DateField value={retirada} onChange={(e) => setRetirada(e.target.value)} /></Field>
        </div>
        <div className="vei-form__linha">
          <Field label="Dias de logística (ida)"><Input type="number" inputMode="numeric" min={0} value={diasIda} onChange={(e) => setDiasIda(e.target.value)} /></Field>
          <Field label="Dias de logística (volta)"><Input type="number" inputMode="numeric" min={0} value={diasVolta} onChange={(e) => setDiasVolta(e.target.value)} /></Field>
        </div>
        {periodoOk && <p className="t-body-sm" data-testid="periodo-reserva">Reserva do carro: <b>{formatarDiaBr(inicio)} a {formatarDiaBr(fim)}</b>, já contando a logística.</p>}
        {onNaoAtendido && <PedidosDoEvento pedidos={pedidosDoEvento} codigoDoCarro={codigoDaReserva} onNaoAtendido={onNaoAtendido} onErro={setErro} />}
        <div className="ds-row" style={{ flexWrap: "wrap", gap: 16 }}>
          {temPedidoAberto && <label className="ds-row" style={{ gap: 6 }}><input type="checkbox" checked={soPedido} onChange={(e) => setSoPedido(e.target.checked)} data-testid="so-pedido" /><span className="t-body-sm">Só os que cabem no pedido</span></label>}
          <label className="ds-row" style={{ gap: 6 }}><input type="checkbox" checked={soLivres} onChange={(e) => setSoLivres(e.target.checked)} data-testid="so-livres" /><span className="t-body-sm">Só disponíveis no período</span></label>
        </div>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar carro (código, modelo, placa, cor)…" aria-label="Buscar carro para reservar" />
        <ul className="mt-escolha" role="list">
          {linhas.length === 0 && <li className="t-body t-muted">Nenhum carro disponível para escolher. {(soPedido && temPedidoAberto) || soLivres ? "Tire um filtro acima ou marque o pedido como “Não estava disponível”." : ""}</li>}
          {linhas.map(({ v, uso, choques, noConserto }) => {
            const u = STATUS_DE_USO.find((x) => x.value === uso)!;
            return (
              <li key={v.id} className="mt-escolha__item">
                <label className="mt-escolha__linha">
                  <input type="checkbox" checked={marcados.has(v.id)} onChange={() => alterna(v.id)} aria-label={`Reservar ${v.codigo ?? v.modelo}`} />
                  <span className="mt-escolha__nome">{v.codigo ?? v.modelo.toUpperCase()}</span>
                  <span className="t-body-sm t-muted">{[v.cor, v.placa].filter(Boolean).join(" · ")}</span>
                  <Tag opcao={{ value: u.value, label: u.label, tom: u.tom }} />
                </label>
                {noConserto.length > 0 && (
                  <p className="mt-escolha__aviso" role="note" data-testid="aviso-manutencao"><Warning size={16} weight="fill" />Em manutenção nesse período: {noConserto.map((m) => m.nome).join(", ")}</p>
                )}
                {choques.length > 0 && (
                  <p className="mt-escolha__aviso" role="note" data-testid="aviso-conflito"><Warning size={16} weight="fill" />Já reservado nesse período: {agendaTexto(choques, (id) => nomes.get(id) ?? "?", hojeLocal())}</p>
                )}
              </li>
            );
          })}
        </ul>
        {comConflito > 0 && <p className="t-body-sm" style={{ color: "var(--color-warning-fg)" }}>{comConflito} carro{comConflito === 1 ? "" : "s"} marcado{comConflito === 1 ? "" : "s"} já tem{comConflito === 1 ? "" : "m"} reserva ou manutenção nesse período. Dá para reservar mesmo assim (troca de carro é comum).</p>}
        {erro && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{erro}</p>}
        <Button size="lg" block disabled={marcados.size === 0 || !periodoOk} loading={enviando} onClick={() => void reservar()} data-testid="confirmar-reserva">
          Reservar {marcados.size} carro{marcados.size === 1 ? "" : "s"}{periodoOk ? ` · ${formatarDiaBr(inicio).slice(0, 5)} a ${formatarDiaBr(fim).slice(0, 5)}` : ""}
        </Button>
      </div>
    </Sheet>
  );
}
