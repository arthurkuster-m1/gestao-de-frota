import { useMemo, useState } from "react";
import { CaretDown, CaretRight, MagnifyingGlass, X } from "@phosphor-icons/react";
import { Button, DateField, Input, Select, cx, useToast } from "../../ds";
import { LinkNoLugar } from "../../app/noLugar";
import { Tag } from "../../components/motor/Tag";
import { formatarDiaBr } from "../../lib/motor/datas";
import { ESTADOS_RESERVA, STATUS_EVENTO, type Evento, type EventoLocal, type ReservaDoEvento } from "../../lib/eventos/tipos";

/** Eventos mais "vivos" primeiro: o que está acontecendo, depois o que vem, e por fim os concluídos. */
const ORDEM_DOS_GRUPOS = ["em_uso", "retorno_solicitado", "solicitar_retorno", "envio_agendado", "solicitar_transporte", "planejado", "recebido", "concluido"];
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
type Linha = { r: ReservaDoEvento; e: Evento; cliente: string; local: string; texto: string };

/**
 * Os eventos do carro, agrupados pelo status do evento. Pesquisa em tudo que se sabe do evento (nome, responsável, contato, cliente, local, datas…),
 * filtra por status e por período, e dá para selecionar vários e "filtrar seleção".
 */
export function EventosDoVeiculo({ reservas, eventos, clientes, locais, onSalvarReserva }: { /** com isto, chegada e retirada se editam aqui (e o evento e os outros lugares acompanham) */ onSalvarReserva?: (id: string, patch: { chegada?: string; retirada?: string }) => Promise<void>; reservas: ReservaDoEvento[]; eventos: Evento[]; clientes: ReadonlyMap<string, string>; locais: readonly EventoLocal[] }) {
  const toast = useToast();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [soSelecao, setSoSelecao] = useState<Set<string> | null>(null);
  const [fechados, setFechados] = useState<Set<string>>(new Set());

  const linhas = useMemo<Linha[]>(() => reservas.flatMap((r) => {
    const e = eventos.find((x) => x.id === r.evento_id); if (!e) return [];
    const cliente = e.cliente_id ? (clientes.get(e.cliente_id) ?? "") : "";
    const loc = locais.filter((l) => l.evento_id === e.id).map((l) => [l.rotulo, l.endereco, l.cidade, l.estado].filter(Boolean).join(" ")).join(" ");
    const estado = ESTADOS_RESERVA.find((x) => x.value === r.estado)?.label ?? r.estado;
    const st = STATUS_EVENTO.find((x) => x.value === e.status)?.label ?? e.status;
    const datas = [r.reserva_inicio, r.reserva_fim, r.chegada, r.retirada, e.chegada_prevista, e.retirada_prevista].filter(Boolean).map((d) => formatarDiaBr(d as string)).join(" ");
    const texto = semAcento([e.nome, e.tipo, st, estado, e.solicitante, e.contato, cliente, loc, e.origem, e.comentarios, r.comentarios, r.origem, r.endereco_chegada, datas].filter(Boolean).join(" "));
    return [{ r, e, cliente, local: loc, texto }];
  }), [reservas, eventos, clientes, locais]);

  const visiveis = useMemo(() => {
    const q = semAcento(busca.trim());
    return linhas.filter((l) => (!q || l.texto.includes(q)) && (!status || l.e.status === status)
      && (!de || (l.r.reserva_fim ?? "") >= de) && (!ate || (l.r.reserva_inicio ?? "9999") <= ate) && (!soSelecao || soSelecao.has(l.r.id)));
  }, [linhas, busca, status, de, ate, soSelecao]);
  const grupos = useMemo(() => ORDEM_DOS_GRUPOS.map((s) => ({ status: s, itens: visiveis.filter((l) => l.e.status === s).sort((a, b) => (b.r.reserva_inicio ?? "").localeCompare(a.r.reserva_inicio ?? "")) })).filter((g) => g.itens.length > 0), [visiveis]);
  const filtrando = !!(busca || status || de || ate || soSelecao);
  const alternar = (id: string) => setMarcados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const limparFiltros = () => { setBusca(""); setStatus(""); setDe(""); setAte(""); setSoSelecao(null); };

  if (linhas.length === 0) return <p className="t-body t-muted">Este carro ainda não foi reservado para nenhum evento.</p>;
  return (
    <div className="ds-stack" data-testid="eventos-do-veiculo">
      <div className="mt-evv__filtros">
        <div className="mt-evv__busca"><MagnifyingGlass size={16} aria-hidden /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar evento, responsável, cliente, local, data…" aria-label="Buscar nos eventos do carro" /></div>
        <Select aria-label="Status do evento" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Status"><option value="">Todos os status</option>{STATUS_EVENTO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
        <div className="mt-evv__datas"><DateField value={de} onChange={(e) => setDe(e.target.value)} aria-label="Eventos a partir de" /><span className="t-body-sm t-muted">até</span><DateField value={ate} onChange={(e) => setAte(e.target.value)} aria-label="Eventos até" /></div>
        {filtrando && <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={limparFiltros}>Limpar filtros</Button>}
      </div>
      {soSelecao && <div className="mt-chips"><span className="mt-chip is-on"><b>Seleção</b><span className="mt-chip__valor">{soSelecao.size} {soSelecao.size === 1 ? "evento" : "eventos"}</span><button type="button" className="mt-chip__lixo" aria-label="Tirar o filtro da seleção" onClick={() => setSoSelecao(null)}>✕</button></span></div>}
      {marcados.size > 0 && (
        <div className="mt-selbar" role="toolbar" aria-label="Ações da seleção" data-testid="barra-selecao-eventos">
          <b>{marcados.size} selecionado{marcados.size === 1 ? "" : "s"}</b>
          <Button size="sm" onClick={() => { setSoSelecao(new Set(marcados)); setMarcados(new Set()); }} data-testid="filtrar-selecao-eventos">Filtrar seleção</Button>
          <Button size="sm" variant="ghost" onClick={() => setMarcados(new Set())}>Limpar seleção</Button>
        </div>
      )}
      {grupos.length === 0 && <p className="t-body t-muted" data-testid="eventos-vazio">Nenhum evento bate com a busca e os filtros.</p>}
      {grupos.map((g) => {
        const s = STATUS_EVENTO.find((x) => x.value === g.status)!; const fechado = fechados.has(g.status);
        return (
          <section key={g.status} className="mt-evv__grupo" data-testid="grupo-eventos">
            <button type="button" className="mt-evv__grupo-cab" aria-expanded={!fechado} onClick={() => setFechados((f) => { const n = new Set(f); if (n.has(g.status)) n.delete(g.status); else n.add(g.status); return n; })}>
              {fechado ? <CaretRight size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}<Tag campoId="status" opcao={{ value: s.value, label: s.label, tom: s.tom }} /><span className="mt-grupo__n">{g.itens.length}</span>
            </button>
            {!fechado && (
              <div className="mt-evv__rolar"><table className="mt-evv__tabela">
                <thead><tr><th className="mt-evv__chk"><input type="checkbox" className="mt-chk-sel" aria-label={`Selecionar todos de ${s.label}`} checked={g.itens.every((l) => marcados.has(l.r.id))} onChange={(e) => setMarcados((m) => { const n = new Set(m); for (const l of g.itens) { if (e.target.checked) n.add(l.r.id); else n.delete(l.r.id); } return n; })} /></th><th>Evento</th><th>Datas</th><th>Carro no evento</th><th>Solicitante</th><th>Contato</th><th>Cliente</th><th>Local</th></tr></thead>
                <tbody>{g.itens.map((l) => {
                  const est = ESTADOS_RESERVA.find((x) => x.value === l.r.estado)!;
                  return (
                    <tr key={l.r.id} className={cx(marcados.has(l.r.id) && "is-sel")} data-testid="linha-evento-do-carro">
                      <td className="mt-evv__chk"><input type="checkbox" className="mt-chk-sel" aria-label={`Selecionar ${l.e.nome}`} checked={marcados.has(l.r.id)} onChange={() => alternar(l.r.id)} /></td>
                      <td><LinkNoLugar to={`/eventos/${l.e.id}`} className="mt-reserva__evento">{l.e.nome}</LinkNoLugar>{l.e.tipo && <span className="t-body-sm t-muted"> · {l.e.tipo}</span>}</td>
                      <td>{onSalvarReserva && l.r.reserva_inicio && l.r.reserva_fim
                        ? <div className="mt-evv__datas-ed"><span className="t-body-sm t-muted">Chegada</span><DateField value={l.r.chegada ?? l.r.reserva_inicio} aria-label={`Chegada em ${l.e.nome}`} onChange={(e) => { if (e.target.value) void onSalvarReserva(l.r.id, { chegada: e.target.value }).catch((x: Error) => toast(x.message)); }} />
                          {l.r.reserva_fim !== "9999-12-31" && <><span className="t-body-sm t-muted">Retirada</span><DateField value={l.r.retirada ?? l.r.reserva_fim} aria-label={`Retirada em ${l.e.nome}`} onChange={(e) => { if (e.target.value) void onSalvarReserva(l.r.id, { retirada: e.target.value }).catch((x: Error) => toast(x.message)); }} /></>}</div>
                        : l.r.reserva_inicio && l.r.reserva_fim ? `${formatarDiaBr(l.r.reserva_inicio)} a ${formatarDiaBr(l.r.reserva_fim)}` : <span className="mt-vazio">Sem data</span>}</td>
                      <td><Tag campoId="estadoReserva" opcao={{ value: est.value, label: est.label, tom: est.tom }} /></td>
                      <td>{l.e.solicitante ?? <span className="mt-vazio">—</span>}</td><td>{l.e.contato ?? <span className="mt-vazio">—</span>}</td><td>{l.cliente || <span className="mt-vazio">—</span>}</td><td>{l.local || <span className="mt-vazio">—</span>}</td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
          </section>
        );
      })}
    </div>
  );
}
