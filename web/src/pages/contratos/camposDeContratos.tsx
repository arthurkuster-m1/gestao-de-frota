import { ArrowSquareOut } from "@phosphor-icons/react";
import type { CampoDaTela, OpcaoDoCampo } from "../../components/motor/tipos";
import { divergenciasDoEvento } from "../../lib/contratos/regras";
import { STATUS_ADITIVO, STATUS_CONTRATO, TIPOS_ADITIVO, rotuloTipoAditivo, type Aditivo, type AditivoVeiculo, type Contrato, type ContratoVeiculo } from "../../lib/contratos/tipos";
import type { Evento, EventoLocal, Reserva } from "../../lib/eventos/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";

const op = (l: readonly { value: string; label: string; tom: OpcaoDoCampo["tom"] }[]): OpcaoDoCampo[] => l.map((x) => ({ value: x.value, label: x.label, tom: x.tom }));
export const OPCOES_STATUS_CONTRATO = op(STATUS_CONTRATO);
export const OPCOES_STATUS_ADITIVO = op(STATUS_ADITIVO);
export const OPCOES_TIPO_ADITIVO = op(TIPOS_ADITIVO);
/** Endereço http(s) completo (a plataforma de assinatura abre numa página). */
export const linkValido = (t: string) => { try { const u = new URL(t.trim()); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; } };
export const codigoDoCarro = (v: Veiculo | undefined) => (v ? (v.codigo ?? v.modelo.toUpperCase()) : "?");

export type EmVigor = { vigencia: { inicio: string | null; fim: string | null }; carros: Set<string>; aditivos: Aditivo[] };
/** Contatos do cliente para o D4Sign: e-mail da parte e da testemunha (cadastrados no cliente). */
export type ContatosDoCliente = { email: string; testemunha: string; testemunhaEmail: string };
export type ContextoDeContratos = { eventos: Map<string, Evento>; clientes: Map<string, string>; veiculos: Map<string, Veiculo>; reservasDoEvento: Map<string, Reserva[]>; emVigor: Map<string, EmVigor>; locais: EventoLocal[]; contatos: Map<string, ContatosDoCliente>; /** para os botões de baixar o DOCX na tabela */ docs?: { carros: ContratoVeiculo[]; itens: AditivoVeiculo[]; baixarContrato: (c: Contrato) => void; baixarAditivo: (c: Contrato, a: Aditivo, numero: number) => void } };

export const divergenciasDoContrato = (c: Contrato, ctx: ContextoDeContratos) => {
  const ev = ctx.emVigor.get(c.id); if (!ev) return [];
  const evento = ctx.eventos.get(c.evento_id);
  return divergenciasDoEvento({ contratoClienteId: c.cliente_id, eventoClienteId: evento?.cliente_id, vigencia: ev.vigencia, carros: ev.carros, reservas: ctx.reservasDoEvento.get(c.evento_id) ?? [], evento: evento ?? { chegada_prevista: null, retirada_prevista: null }, nomeDoCarro: (id) => codigoDoCarro(ctx.veiculos.get(id)), nomeDoCliente: (id) => ctx.clientes.get(id) ?? "?" });
};

/** Os campos de contrato. Evento, Cliente, Vigência em vigor, Carros, Aditivos e Divergências são CALCULADOS (só leitura). */
export const camposDoContrato = (ctx: ContextoDeContratos): CampoDaTela<Contrato>[] => [
  { id: "evento", titulo: "Evento", tipo: "texto", valorDe: (c) => ctx.eventos.get(c.evento_id)?.nome ?? "?", largura: 240, fixa: true },
  { id: "cliente", titulo: "Cliente", tipo: "texto", valorDe: (c) => ctx.clientes.get(c.cliente_id) ?? "?", largura: 220 },
  { id: "status", titulo: "Status", tipo: "opcao", valorDe: (c) => c.status, opcoes: OPCOES_STATUS_CONTRATO, rotuloDoValor: (x) => OPCOES_STATUS_CONTRATO.find((o) => o.value === x)?.label ?? x, ordemDoValor: (x) => STATUS_CONTRATO.findIndex((s) => s.value === x), largura: 210, edicao: { coluna: "status", obrigatorio: true } },
  { id: "inicio", titulo: "Vigência início", tipo: "data", valorDe: (c) => c.vigencia_inicio, largura: 160 },
  { id: "fim", titulo: "Vigência fim (contrato)", tipo: "data", valorDe: (c) => c.vigencia_fim, largura: 190 },
  { id: "fimEmVigor", titulo: "Fim em vigor", tipo: "data", valorDe: (c) => ctx.emVigor.get(c.id)?.vigencia.fim ?? null, largura: 150 },
  { id: "carros", titulo: "Carros em vigor", tipo: "texto", valorDe: (c) => { const s = ctx.emVigor.get(c.id)?.carros; return s && s.size ? `${s.size} · ${[...s].map((id) => codigoDoCarro(ctx.veiculos.get(id))).join(", ")}` : null; }, largura: 320 },
  { id: "aditivos", titulo: "Aditivos", tipo: "texto", valorDe: (c) => { const a = ctx.emVigor.get(c.id)?.aditivos ?? []; if (!a.length) return null; const ass = a.filter((x) => x.status === "assinado").length; return `${a.length} · ${ass} assinado${ass === 1 ? "" : "s"}`; }, largura: 160 },
  { id: "divergencia", titulo: "Divergência", tipo: "texto", valorDe: (c) => { const d = divergenciasDoContrato(c, ctx); return d.length ? `${d.length} divergência${d.length === 1 ? "" : "s"}` : "Confere"; }, celula: (c) => { const d = divergenciasDoContrato(c, ctx); return d.length ? <span style={{ color: "var(--color-warning-fg)", fontWeight: 600 }}>{d.length} divergência{d.length === 1 ? "" : "s"}</span> : <span className="t-muted">Confere</span>; }, largura: 160 },
  { id: "assinadoEm", titulo: "Assinado em", tipo: "data", valorDe: (c) => c.assinado_em, largura: 150, padrao: false },
  { id: "documentos", titulo: "Documentos (DOCX)", tipo: "texto", valorDe: () => null, largura: 300, celula: (c) => {
    const d = ctx.docs; if (!d) return <span className="mt-vazio">—</span>;
    const ads = ctx.emVigor.get(c.id)?.aditivos ?? [];
    return <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="mt-btn" onClick={() => d.baixarContrato(c)} title="Baixar o contrato em DOCX" data-testid="tabela-baixar-contrato">⬇ Contrato</button>
      {ads.map((a, n) => <button key={a.id} type="button" className="mt-btn" onClick={() => d.baixarAditivo(c, a, n + 1)} title={a.titulo ?? `Aditivo ${n + 1}`} data-testid="tabela-baixar-aditivo">⬇ Aditivo {n + 1}</button>)}
    </span>; } },
  { id: "link", titulo: "Link (assinatura)", tipo: "texto", valorDe: (c) => c.link ?? null, largura: 300,
    edicao: { coluna: "link", maxLength: 2000, placeholder: "Cole o link do contrato na plataforma de assinatura", normalizar: (t) => (/^https?:\/\//i.test(t.trim()) || !t.trim() ? t.trim() : `https://${t.trim()}`), validar: (t) => (linkValido(t) ? null : "Link inválido: cole o endereço completo (https://…).") },
    celula: (c) => c.link
      ? <span className="mt-link-contrato" onClick={(e) => e.stopPropagation()}>
          <a href={c.link} target="_blank" rel="noopener noreferrer" title={c.link} data-testid="link-do-contrato">{c.link.replace(/^https?:\/\//i, "")}</a>
          <a className="mt-btn mt-btn--icone" href={c.link} target="_blank" rel="noopener noreferrer" aria-label="Abrir o contrato na plataforma de assinatura" title="Abrir o contrato na plataforma de assinatura" data-testid="abrir-link-do-contrato"><ArrowSquareOut size={16} /></a>
        </span>
      : <span className="mt-vazio">Clique para colar o link</span> },
  { id: "emailParte", titulo: "E-mail da parte", tipo: "texto", valorDe: (c) => ctx.contatos.get(c.cliente_id)?.email || null, largura: 240 },
  { id: "testemunha", titulo: "Testemunha", tipo: "texto", valorDe: (c) => ctx.contatos.get(c.cliente_id)?.testemunha || null, largura: 200 },
  { id: "emailTestemunha", titulo: "E-mail da testemunha", tipo: "texto", valorDe: (c) => ctx.contatos.get(c.cliente_id)?.testemunhaEmail || null, largura: 240 },
  { id: "criadoEm", titulo: "Criado em", tipo: "data", valorDe: (c) => c.created_at.slice(0, 10), largura: 150, padrao: false },
];

/** Os campos de um aditivo, editáveis no lugar dentro da janela do contrato. */
export const camposDoAditivo: CampoDaTela<Aditivo>[] = [
  { id: "titulo", titulo: "Título", tipo: "texto", valorDe: (a) => a.titulo, largura: 300, edicao: { coluna: "titulo", maxLength: 200 } },
  { id: "dataEfeito", titulo: "Vale a partir de", tipo: "data", valorDe: (a) => a.data_efeito, largura: 160, edicao: { coluna: "data_efeito" } },
  { id: "tipo", titulo: "Tipo", tipo: "opcao", valorDe: (a) => a.tipo, opcoes: OPCOES_TIPO_ADITIVO, rotuloDoValor: rotuloTipoAditivo, largura: 170 },
  { id: "status", titulo: "Status", tipo: "opcao", valorDe: (a) => a.status, opcoes: OPCOES_STATUS_ADITIVO, rotuloDoValor: (x) => OPCOES_STATUS_ADITIVO.find((o) => o.value === x)?.label ?? x, largura: 210, edicao: { coluna: "status", obrigatorio: true } },
  { id: "novoFim", titulo: "Novo fim da vigência", tipo: "data", valorDe: (a) => a.vigencia_fim_nova, largura: 170, edicao: { coluna: "vigencia_fim_nova" } },
  { id: "motivo", titulo: "Motivo", tipo: "texto", valorDe: (a) => a.motivo, largura: 260, edicao: { coluna: "motivo", maxLength: 2000 } },
  { id: "assinadoEm", titulo: "Assinado em", tipo: "data", valorDe: (a) => a.assinado_em, largura: 150, edicao: { coluna: "assinado_em" } },
];
