import { LinkNoLugar, useAbrirNoLugar } from "../../app/noLugar";
import { useMemo, useState, type ReactNode } from "react";
import { CaretLeft, CaretRight, ClipboardText, Columns, ListChecks, Lock, Plus, Trash, Warning } from "@phosphor-icons/react";
import { validarEndereco } from "../../lib/enderecos";
import { Button, Switch, cx, useToast } from "../../ds";
import { Tag } from "../../components/motor/Tag";
import { CampoEditavel } from "../../components/motor/CampoEditavel";
import { Painel } from "../../components/motor/Painel";
import type { CampoDaTela } from "../../components/motor/tipos";
import { useEdicao, type OnEditar } from "../../components/motor/useEdicao";
import { formatarDiaBr, hojeLocal } from "../../lib/motor/datas";
import { codigoDaLinha, custoDoEvento, montarLinhas, tabelaParaOutlook, valoresEfetivos, type LinhaDoEvento } from "../../lib/eventos/linhasDoEvento";
import type { Evento, EventoLocal, ModeloDesejado, Reserva } from "../../lib/eventos/tipos";
import { conflitos, reservasPorVeiculo, agendaTexto } from "../../lib/eventos/uso";
import { reais } from "../../lib/transportes/regras";
import type { Sentido, Transporte } from "../../lib/transportes/tipos";
import type { Manutencao } from "../../lib/manutencoes/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";
import type { Checklist, ChecklistNovo, Momento } from "../../lib/checklists/tipos";
import { ChecklistsDaReserva } from "../checklists/ChecklistsDaReserva";
import type { useTransportes } from "../transportes/useTransportes";
import { Sheet } from "../../ds";
import { AdicionarVeiculos } from "./AdicionarVeiculos";
import { OPCOES_STATUS_EVENTO } from "./camposDoEvento";
import { TransporteDoCarroSheet } from "./TransporteDoCarroSheet";

type Tr = ReturnType<typeof useTransportes>;
type ColunaOpcional = "status" | "transporteIda" | "transporteVolta" | "origem" | "chegada" | "enderecoChegada" | "retirada";
const COLUNAS_OPCIONAIS: { id: ColunaOpcional; titulo: string }[] = [
  { id: "status", titulo: "Status do carro" }, { id: "transporteIda", titulo: "Transporte de ida" }, { id: "transporteVolta", titulo: "Transporte de volta" },
  { id: "origem", titulo: "Origem" }, { id: "chegada", titulo: "Data de chegada" }, { id: "enderecoChegada", titulo: "Endereço de chegada" }, { id: "retirada", titulo: "Data de retirada" },
];
const CHAVE = "frota:evento-veiculos:v1";
type Prefs = { info: boolean; colunas: ColunaOpcional[] };
function lerPrefs(): Prefs { try { const p = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as Prefs | null; if (p && typeof p.info === "boolean" && Array.isArray(p.colunas)) return p; } catch { /* sem armazenamento */ } return { info: false, colunas: [] }; }
function gravarPrefs(p: Prefs) { try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch { /* sem armazenamento */ } }

type Props = {
  evento: Evento; veiculos: Veiculo[]; reservas: Reserva[]; eventos: Evento[]; locais: EventoLocal[]; desejados: ModeloDesejado[]; manutencoes?: Manutencao[]; tr: Tr;
  checklists?: Checklist[]; onSalvarChecklist?: (reservaId: string, momento: Momento, existente: Checklist | null, dados: Omit<ChecklistNovo, "reserva_id" | "momento">) => Promise<void>;
  onSalvarReserva: (id: string, patch: Partial<Pick<Reserva, "chegada" | "retirada" | "origem" | "endereco_chegada" | "status_individual">>) => Promise<void>;
  onReservar: (eventoId: string, veiculoIds: string[], inicio: string, fim: string, janela: { chegada: string; retirada: string }, pedidoId?: string) => Promise<void>;
  onRemoverReserva: (r: Reserva) => Promise<void>; onNaoAtendido: (id: string, naoAtendido: boolean) => Promise<void>; onErro: (m: string) => void;
};

/**
 * Os carros do evento numa tabela só. Padrão: "Definido" (marcado quando o carro já foi escolhido; clicar abre a escolha já filtrada pelo pedido da linha)
 * e "Código" (com a setinha que abre Placa/VIN/Modelo/Cor/MY e o botão que copia a tabelinha para o Outlook). Eventos grandes mostram
 * as colunas individuais (status, transportes, origem, chegada, endereço, retirada): herdam do evento até ligar "Edição individual".
 */
export function VeiculosDoEvento({ evento, veiculos, reservas, eventos, locais, desejados, manutencoes, tr, checklists = [], onSalvarChecklist, onSalvarReserva, onReservar, onRemoverReserva, onNaoAtendido, onErro }: Props) {
  const toast = useToast();
  const [prefs, setPrefs] = useState<Prefs>(lerPrefs);
  const muda = (p: Prefs) => { setPrefs(p); gravarPrefs(p); };
  const [individual, setIndividual] = useState(false);
  const [escolhendo, setEscolhendo] = useState<{ pedido: ModeloDesejado | null } | null>(null);
  const [transporte, setTransporte] = useState<{ linha: LinhaDoEvento; sentido: Sentido } | null>(null);
  const [checklist, setChecklist] = useState<LinhaDoEvento | null>(null);

  const pedidosDoEvento = useMemo(() => desejados.filter((p) => p.evento_id === evento.id), [desejados, evento.id]);
  const locaisDoEvento = useMemo(() => locais.filter((l) => l.evento_id === evento.id), [locais, evento.id]);
  const linhas = useMemo(() => montarLinhas(evento.id, reservas, pedidosDoEvento, veiculos), [evento.id, reservas, pedidosDoEvento, veiculos]);
  const porCarro = useMemo(() => reservasPorVeiculo(reservas), [reservas]);
  const nomes = useMemo(() => new Map(eventos.map((e) => [e.id, e.nome])), [eventos]);
  const transporteDe = (l: LinhaDoEvento, s: Sentido): Transporte | null => {
    const v = l.reserva && tr.vinculos.find((x) => x.id === l.reserva!.id); const id = v ? (s === "ida" ? v.transporte_ida_id : v.transporte_volta_id) : null;
    return id ? (tr.transportes.find((t) => t.id === id) ?? null) : null;
  };
  const custo = custoDoEvento(tr.transportes, evento.id);
  const mostra = (c: ColunaOpcional) => prefs.colunas.includes(c);

  const ed = useEdicao<LinhaDoEvento>((l) => l.key, individual ? async (l, campo, valor) => {
    if (!l.reserva) throw new Error("Defina o veículo desta linha primeiro.");
    await onSalvarReserva(l.reserva.id, { [campo.edicao!.coluna]: valor } as never);
  } : undefined);

  const campo = (id: string, titulo: string, tipo: "texto" | "data" | "opcao", coluna: string, valorDe: (l: LinhaDoEvento) => { valor: string | null; herdado: boolean }): CampoDaTela<LinhaDoEvento> => ({
    id, titulo, tipo, largura: 160, edicao: coluna === "origem" || coluna === "endereco_chegada" ? { coluna, endereco: true, validar: validarEndereco } : { coluna }, valorDe: (l) => valorDe(l).valor, ...(tipo === "opcao" ? { opcoes: OPCOES_STATUS_EVENTO } : {}),
    celula: (l) => { const { valor, herdado } = valorDe(l); const txt = !valor ? "—" : tipo === "data" ? formatarDiaBr(valor) : tipo === "opcao" ? <Tag opcao={OPCOES_STATUS_EVENTO.find((o) => o.value === valor) ?? { value: valor, label: valor }} campoId="status" /> : valor;
      return <span className={cx(herdado && "mt-herdado")} title={herdado && valor ? "Vem do evento" : undefined}>{txt}</span>; },
  });
  const campos = useMemo(() => ({
    status: campo("status", "Status do carro", "opcao", "status_individual", (l) => valoresEfetivos(l, evento, locaisDoEvento).status),
    origem: campo("origem", "Origem", "texto", "origem", (l) => valoresEfetivos(l, evento, locaisDoEvento).origem),
    chegada: campo("chegada", "Data de chegada", "data", "chegada", (l) => valoresEfetivos(l, evento, locaisDoEvento).chegada),
    enderecoChegada: campo("enderecoChegada", "Endereço de chegada", "texto", "endereco_chegada", (l) => valoresEfetivos(l, evento, locaisDoEvento).enderecoChegada),
    retirada: campo("retirada", "Data de retirada", "data", "retirada", (l) => valoresEfetivos(l, evento, locaisDoEvento).retirada),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [evento, locaisDoEvento]);
  const navegaveis = Object.keys(campos);
  const celulaEditavel = (l: LinhaDoEvento, c: CampoDaTela<LinhaDoEvento>) => (l.reserva && individual ? <CampoEditavel linha={l} campo={c} ed={ed} navegaveis={navegaveis} /> : <span className="mt-valor">{c.celula?.(l)}</span>);

  async function copiar() {
    const t = tabelaParaOutlook(linhas);
    if (!linhas.some((l) => l.veiculo)) { toast("Nenhum carro definido para copiar"); return; }
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([t.html], { type: "text/html" }), "text/plain": new Blob([t.texto], { type: "text/plain" }) })]);
      else await navigator.clipboard.writeText(t.texto);
      toast("Tabela copiada: cole no Outlook");
    } catch { onErro("Não consegui copiar. Libere a área de transferência no navegador."); }
  }

  const resumoTransporte = (l: LinhaDoEvento, s: Sentido): ReactNode => {
    const t = transporteDe(l, s);
    if (!t) return <span className="mt-vazio">{l.reserva ? "＋ Definir" : "—"}</span>;
    const m = t.modalidade === "pta" ? "PTA" : t.modalidade === "tso" ? "TSO" : "Retirada";
    return <span className="mt-transp"><b>{m}</b>{t.referencia ? ` ${t.referencia}` : ""}{t.transportadora ? ` · ${t.transportadora}` : ""}{t.valor_planejado != null ? ` · ${reais(t.valor_planejado)}` : ""}</span>;
  };

  const definidos = linhas.filter((l) => l.reserva).length;
  const colunasInfo = prefs.info ? ["Placa", "VIN", "Modelo", "Cor", "MY"] : [];
  const pedidoAlvo = escolhendo?.pedido ?? null;

  return (
    <div className="mt-vde" data-testid="veiculos-do-evento">
      <div className="mt-vde__barra">
        <div><h3 className="t-h3">Carros deste evento</h3><span className="t-body-sm t-muted">{definidos} definido{definidos === 1 ? "" : "s"} · {linhas.length - definidos} a definir</span></div>
        <div className="ds-row" style={{ flexWrap: "wrap", gap: 12 }}>
          <span title="Liga a edição de status, transporte, origem, datas e endereço de cada carro"><Switch checked={individual} onChange={setIndividual} label="Edição individual" /></span>
          <Painel rotulo="Colunas" icone={<Columns size={18} />} contagem={prefs.colunas.length} largura={280} testid="colunas-do-evento">
            <div className="mt-painel__corpo">
              {COLUNAS_OPCIONAIS.map((c) => <label key={c.id} className="mt-notion__linha"><input type="checkbox" checked={mostra(c.id)} onChange={() => muda({ ...prefs, colunas: mostra(c.id) ? prefs.colunas.filter((x) => x !== c.id) : [...prefs.colunas, c.id] })} />{c.titulo}</label>)}
            </div>
          </Painel>
          <Button icon={<Plus size={18} />} onClick={() => setEscolhendo({ pedido: null })} data-testid="adicionar-carros">Reservar carros</Button>
        </div>
      </div>

      <div className="mt-vde__rolar">
        <table className="mt-vde__tabela">
          <thead><tr>
            <th className="mt-vde__def">Definido</th>
            <th><span className="mt-vde__cod">Código
              <button type="button" className="mt-btn mt-btn--icone" aria-label={prefs.info ? "Esconder placa, VIN, modelo, cor e MY" : "Mostrar placa, VIN, modelo, cor e MY"} aria-expanded={prefs.info} onClick={() => muda({ ...prefs, info: !prefs.info })} data-testid="toggle-info">{prefs.info ? <CaretLeft size={16} weight="bold" /> : <CaretRight size={16} weight="bold" />}</button>
              <button type="button" className="mt-btn mt-btn--icone" aria-label="Copiar tabela para o Outlook" title="Copiar para o Outlook" onClick={() => void copiar()} data-testid="copiar-outlook"><ClipboardText size={16} /></button></span></th>
            {colunasInfo.map((c) => <th key={c}>{c}</th>)}
            {COLUNAS_OPCIONAIS.filter((c) => mostra(c.id)).map((c) => <th key={c.id}>{c.titulo}</th>)}
            <th className="mt-vde__acoes" aria-label="Ações" />
          </tr></thead>
          <tbody>
            {linhas.length === 0 && <tr><td colSpan={3 + colunasInfo.length + prefs.colunas.length} className="t-body t-muted" style={{ padding: 16 }}>Nenhum carro ainda. Peça modelos no cadastro do evento ou reserve carros.</td></tr>}
            {linhas.map((l) => {
              const v = l.veiculo; const r = l.reserva;
              const choques = r && v ? conflitos({ inicio: r.reserva_inicio, fim: r.reserva_fim }, porCarro.get(r.veiculo_id) ?? [], evento.id) : [];
              return (
                <tr key={l.key} className={cx(!r && "is-aberta", l.pedido?.nao_atendido && "is-falta")} data-testid="linha-veiculo">
                  <td className="mt-vde__def">
                    <input type="checkbox" checked={!!r} readOnly disabled={!!r} aria-label={r ? "Veículo definido" : "Definir veículo"} title={r ? "Veículo definido" : "Escolher o veículo"} data-testid="check-definido"
                      onClick={() => { if (!r) setEscolhendo({ pedido: l.pedido }); }} onChange={() => undefined} style={{ cursor: r ? "default" : "pointer" }} />
                  </td>
                  <td>
                    <span className="mt-vde__codigo">
                      {!r && <Lock size={14} weight="fill" aria-label="Pedido do evento" />}
                      {v ? <LinkNoLugar to={`/veiculos/${v.id}`} className="mt-reserva__evento">{codigoDaLinha(l)}</LinkNoLugar> : <span className="mt-vde__pedido">{codigoDaLinha(l)}</span>}
                      {l.pedido?.nao_atendido && <span className="t-body-sm" style={{ color: "var(--color-error-fg)" }}>Veículo não estava disponível</span>}
                      {choques.length > 0 && <span title={`Também está em: ${agendaTexto(choques, (x) => nomes.get(x) ?? "?", hojeLocal())}`} data-testid="aviso-conflito"><Warning size={16} weight="fill" /></span>}
                    </span>
                  </td>
                  {prefs.info && [v?.placa, v?.vin, v?.modelo, v?.cor, v?.my].map((x, i) => <td key={i}>{x ?? <span className="mt-vazio">—</span>}</td>)}
                  {mostra("status") && <td>{celulaEditavel(l, campos.status)}</td>}
                  {mostra("transporteIda") && <td><button type="button" className="mt-valor mt-valor--edita" disabled={!r} onClick={() => setTransporte({ linha: l, sentido: "ida" })}>{resumoTransporte(l, "ida")}</button></td>}
                  {mostra("transporteVolta") && <td><button type="button" className="mt-valor mt-valor--edita" disabled={!r} onClick={() => setTransporte({ linha: l, sentido: "volta" })}>{resumoTransporte(l, "volta")}</button></td>}
                  {mostra("origem") && <td>{celulaEditavel(l, campos.origem)}</td>}
                  {mostra("chegada") && <td>{celulaEditavel(l, campos.chegada)}</td>}
                  {mostra("enderecoChegada") && <td>{celulaEditavel(l, campos.enderecoChegada)}</td>}
                  {mostra("retirada") && <td>{celulaEditavel(l, campos.retirada)}</td>}
                  <td className="mt-vde__acoes">
                    {r && onSalvarChecklist && <Button variant="ghost" size="icon" aria-label={`Checklists de ${codigoDaLinha(l)}`} title="Checklists" onClick={() => setChecklist(l)}><ListChecks size={20} /></Button>}
                    {r && <Button variant="ghost" size="icon" aria-label={`Remover ${codigoDaLinha(l)} do evento`} onClick={() => void onRemoverReserva(r).catch((e: Error) => onErro(e.message))}><Trash size={20} /></Button>}
                    {!r && l.pedido && !l.pedido.nao_atendido && <Button variant="ghost" size="sm" onClick={() => void onNaoAtendido(l.pedido!.id, true).catch((e: Error) => onErro(e.message))} data-testid="nao-disponivel">Não estava disponível</Button>}
                    {!r && l.pedido?.nao_atendido && <Button variant="ghost" size="sm" onClick={() => void onNaoAtendido(l.pedido!.id, false).catch((e: Error) => onErro(e.message))}>Desfazer</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="t-body-sm mt-vde__total" data-testid="custo-do-evento">Transportes do evento: <b>{custo.quantidade}</b> · custo planejado <b>{reais(custo.total)}</b>{individual ? "" : " · ligue “Edição individual” para planejar carro a carro"}</p>
      {ed.erro && <p className="mt-erro" role="alert"><span>{ed.erro}</span></p>}

      <AdicionarVeiculos aberto={!!escolhendo} onFechar={() => setEscolhendo(null)} evento={evento} veiculos={veiculos} reservas={reservas} eventos={eventos} manutencoes={manutencoes}
        pedidos={pedidoAlvo ? [pedidoAlvo] : desejados} onNaoAtendido={onNaoAtendido} onReservar={(ids, ini, fim, janela) => onReservar(evento.id, ids, ini, fim, janela, pedidoAlvo?.id)} />
      <TransporteDoCarroSheet aberto={!!transporte} onFechar={() => setTransporte(null)} tr={tr} eventoId={evento.id} reservaId={transporte?.linha.reserva?.id ?? null}
        carro={transporte ? codigoDaLinha(transporte.linha) : ""} sentido={transporte?.sentido ?? "ida"} atual={transporte ? transporteDe(transporte.linha, transporte.sentido) : null} />
      <Sheet open={!!checklist} onClose={() => setChecklist(null)} title="Checklists" wide>
        {checklist?.reserva && onSalvarChecklist && <ChecklistsDaReserva reservaId={checklist.reserva.id} carro={codigoDaLinha(checklist)} checklists={checklists} onSalvar={onSalvarChecklist} />}
      </Sheet>
    </div>
  );
}
