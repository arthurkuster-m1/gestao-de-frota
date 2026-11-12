import { createReactBlockSpec } from "@blocknote/react";
import { useEffect, useRef, type ReactNode } from "react";
import { Plus, Trash } from "@phosphor-icons/react";

/**
 * Os BLOCOS VISUAIS das Anotações: destaque, fluxo, matriz, cartões, métricas e pirâmide/funil.
 * O destaque é texto de verdade. Os demais guardam a lista como JSON numa propriedade de texto (`dados`)
 * e se editam com campos dentro do bloco. Dado ruim vira o padrão (`lerLista`), nunca quebra a tela.
 */

interface PropsDeRender {
  block: { props: Record<string, string> };
  editor: { isEditable: boolean; updateBlock: (bloco: never, mudanca: never) => unknown };
  contentRef?: (no: HTMLElement | null) => void;
}
interface Item { titulo: string; texto: string }

const MAXIMO_DE_ITENS = 12;
const CURTO = 200;
const LONGO = 1200;

export function lerLista<T>(bruto: string, padrao: T[], formato: (x: unknown) => T | null): T[] {
  try {
    const valor: unknown = JSON.parse(bruto);
    if (!Array.isArray(valor)) return padrao;
    return valor.map(formato).filter((x): x is T => x !== null).slice(0, MAXIMO_DE_ITENS);
  } catch { return padrao; }
}
const texto = (x: unknown, teto: number) => (typeof x === "string" ? x.slice(0, teto) : "");
const formatoDeItem = (x: unknown): Item | null =>
  typeof x === "object" && x !== null ? { titulo: texto((x as Record<string, unknown>).titulo, CURTO), texto: texto((x as Record<string, unknown>).texto, LONGO) } : null;

/** Campos dentro de um bloco: o editor não pode "roubar" as teclas de quem escreve num campo. */
function Isolado({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const parar = (e: Event) => e.stopPropagation();
    const eventos = ["keydown", "keyup", "keypress", "beforeinput", "input", "paste", "cut", "copy", "mousedown"];
    for (const ev of eventos) el.addEventListener(ev, parar);
    return () => { for (const ev of eventos) el.removeEventListener(ev, parar); };
  }, []);
  return <div ref={ref} contentEditable={false} className={className}>{children}</div>;
}

function Campo({ valor, aoMudar, placeholder, editavel, multilinha, className = "" }: { valor: string; aoMudar: (v: string) => void; placeholder: string; editavel: boolean; multilinha?: boolean; className?: string }) {
  if (!editavel) return valor ? <p className={`bv-leitura ${className}`}>{valor}</p> : null;
  return multilinha
    ? <textarea value={valor} rows={2} onChange={(e) => aoMudar(e.target.value)} placeholder={placeholder} className={`bv-campo ${className}`} />
    : <input value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={placeholder} className={`bv-campo ${className}`} />;
}

function BotaoPequeno({ aoClicar, rotulo, children }: { aoClicar: () => void; rotulo: string; children: ReactNode }) {
  return <button type="button" aria-label={rotulo} title={rotulo} onClick={aoClicar} className="bv-mini">{children}</button>;
}

function useItens(bloco: { props: Record<string, string> }, editor: { updateBlock: (b: never, u: never) => unknown }, padrao: Item[]) {
  const itens = lerLista(bloco.props.dados ?? "", padrao, formatoDeItem);
  const gravar = (novos: Item[]) => editor.updateBlock(bloco as never, { props: { dados: JSON.stringify(novos) } } as never);
  return {
    itens,
    mudar: (i: number, campo: keyof Item, valor: string) => gravar(itens.map((it, k) => (k === i ? { ...it, [campo]: valor } : it))),
    adicionar: () => gravar([...itens, { titulo: "", texto: "" }].slice(0, MAXIMO_DE_ITENS)),
    remover: (i: number) => gravar(itens.filter((_, k) => k !== i)),
  };
}

const PADRAO_FLUXO: Item[] = [{ titulo: "Etapa 1", texto: "" }, { titulo: "Etapa 2", texto: "" }, { titulo: "Etapa 3", texto: "" }];
const PADRAO_CARTOES: Item[] = [{ titulo: "Título", texto: "" }, { titulo: "Título", texto: "" }];
const PADRAO_METRICAS: Item[] = [{ titulo: "0", texto: "Legenda" }, { titulo: "0", texto: "Legenda" }];

// ── Destaque ──
const TONS = ["info", "sucesso", "atencao"] as const;
type Tom = (typeof TONS)[number];
const NOME_DO_TOM: Record<Tom, string> = { info: "Informação", sucesso: "Sucesso", atencao: "Atenção" };

function RenderDoDestaque(props: PropsDeRender) {
  const tom = (TONS as readonly string[]).includes(props.block.props.tom ?? "") ? (props.block.props.tom as Tom) : "info";
  return (
    <div className={`bv-destaque bv-tom-${tom}`}>
      <div ref={props.contentRef} className="bv-destaque__texto" />
      {props.editor.isEditable ? (
        <Isolado className="bv-tons">
          {TONS.map((o) => (
            <button key={o} type="button" aria-label={NOME_DO_TOM[o]} title={NOME_DO_TOM[o]} className={`bv-bolinha bv-bolinha--${o}${o === tom ? " is-ativa" : ""}`}
              onClick={() => props.editor.updateBlock(props.block as never, { props: { tom: o } } as never)} />
          ))}
        </Isolado>
      ) : null}
    </div>
  );
}
const criarDestaque = createReactBlockSpec({ type: "destaque", propSchema: { tom: { default: "info" } }, content: "inline" }, { render: RenderDoDestaque });

// ── Fluxo ──
function RenderDoFluxo(props: PropsDeRender) {
  const editavel = props.editor.isEditable;
  const { itens, mudar, adicionar, remover } = useItens(props.block, props.editor as never, PADRAO_FLUXO);
  return (
    <Isolado className="bv-bloco">
      <div className="bv-fluxo">
        {itens.map((it, i) => (
          <div key={i} className="bv-fluxo__passo">
            <div className="bv-caixa">
              <span className="bv-numero">{i + 1}</span>
              <Campo valor={it.titulo} aoMudar={(v) => mudar(i, "titulo", v)} placeholder="Etapa" editavel={editavel} className="bv-titulo" />
              <Campo valor={it.texto} aoMudar={(v) => mudar(i, "texto", v)} placeholder="Detalhe" editavel={editavel} multilinha className="bv-sub" />
              {editavel && itens.length > 1 ? <span className="bv-remover"><BotaoPequeno aoClicar={() => remover(i)} rotulo="Remover etapa"><Trash size={12} /></BotaoPequeno></span> : null}
            </div>
            {i < itens.length - 1 ? <span aria-hidden className="bv-seta">→</span> : null}
          </div>
        ))}
        {editavel && itens.length < MAXIMO_DE_ITENS ? <div className="bv-add"><BotaoPequeno aoClicar={adicionar} rotulo="Adicionar etapa"><Plus size={14} /></BotaoPequeno></div> : null}
      </div>
    </Isolado>
  );
}
const criarFluxo = createReactBlockSpec({ type: "fluxo", propSchema: { dados: { default: JSON.stringify(PADRAO_FLUXO) } }, content: "none" }, { render: RenderDoFluxo });

// ── Cartões e métricas (mesma estrutura, aparências diferentes) ──
function Grade({ props, padrao, classeDaGrade, classeDoTitulo, classeDoTexto, placeholderDoTitulo, placeholderDoTexto, nome, nomeAdicionar, curto }: {
  props: PropsDeRender; padrao: Item[]; classeDaGrade: string; classeDoTitulo: string; classeDoTexto: string; placeholderDoTitulo: string; placeholderDoTexto: string; nome: string; nomeAdicionar: string; curto?: boolean;
}) {
  const editavel = props.editor.isEditable;
  const { itens, mudar, adicionar, remover } = useItens(props.block, props.editor as never, padrao);
  return (
    <Isolado className="bv-bloco">
      <div className={classeDaGrade}>
        {itens.map((it, i) => (
          <div key={i} className="bv-caixa">
            <Campo valor={it.titulo} aoMudar={(v) => mudar(i, "titulo", curto ? v.slice(0, 40) : v)} placeholder={placeholderDoTitulo} editavel={editavel} className={classeDoTitulo} />
            <Campo valor={it.texto} aoMudar={(v) => mudar(i, "texto", v)} placeholder={placeholderDoTexto} editavel={editavel} multilinha={!curto} className={classeDoTexto} />
            {editavel && itens.length > 1 ? <span className="bv-remover"><BotaoPequeno aoClicar={() => remover(i)} rotulo={nome}><Trash size={12} /></BotaoPequeno></span> : null}
          </div>
        ))}
        {editavel && itens.length < MAXIMO_DE_ITENS ? <button type="button" onClick={adicionar} className="bv-adicionar"><Plus size={12} /> {nomeAdicionar}</button> : null}
      </div>
    </Isolado>
  );
}
const criarCartoes = createReactBlockSpec({ type: "cartoes", propSchema: { dados: { default: JSON.stringify(PADRAO_CARTOES) } }, content: "none" }, {
  render: (p) => <Grade props={p as never} padrao={PADRAO_CARTOES} classeDaGrade="bv-grade bv-grade--cartoes" classeDoTitulo="bv-titulo" classeDoTexto="bv-sub" placeholderDoTitulo="Título" placeholderDoTexto="Texto" nome="Remover cartão" nomeAdicionar="Adicionar cartão" />,
});
const criarMetricas = createReactBlockSpec({ type: "metricas", propSchema: { dados: { default: JSON.stringify(PADRAO_METRICAS) } }, content: "none" }, {
  render: (p) => <Grade props={p as never} padrao={PADRAO_METRICAS} classeDaGrade="bv-grade bv-grade--metricas" classeDoTitulo="bv-numerao" classeDoTexto="bv-sub" placeholderDoTitulo="0" placeholderDoTexto="Legenda" nome="Remover métrica" nomeAdicionar="Adicionar métrica" curto />,
});

// ── Matriz 2x2 / SWOT ──
const SWOT: Item[] = [{ titulo: "Forças", texto: "" }, { titulo: "Fraquezas", texto: "" }, { titulo: "Oportunidades", texto: "" }, { titulo: "Ameaças", texto: "" }];
const COR_DO_SWOT = ["sucesso", "erro", "info", "atencao"];
export function lerMatriz(bruto: string): Item[] {
  const itens = lerLista(bruto, SWOT, formatoDeItem);
  return Array.from({ length: 4 }, (_, i) => itens[i] ?? SWOT[i]!);
}
function RenderDaMatriz(props: PropsDeRender) {
  const editavel = props.editor.isEditable;
  const itens = lerMatriz(props.block.props.dados ?? "");
  const swot = props.block.props.estilo !== "neutro";
  const gravar = (novos: Item[]) => props.editor.updateBlock(props.block as never, { props: { dados: JSON.stringify(novos) } } as never);
  return (
    <Isolado className="bv-bloco">
      {editavel ? (
        <div className="bv-barra"><button type="button" className="bv-texto-botao" onClick={() => props.editor.updateBlock(props.block as never, { props: { estilo: swot ? "neutro" : "swot" } } as never)}>{swot ? "Estilo: SWOT colorido" : "Estilo: neutro"}</button></div>
      ) : null}
      <div className="bv-grade bv-grade--matriz">
        {itens.map((it, i) => (
          <div key={i} className={`bv-caixa bv-matriz-caixa ${swot ? `bv-tom-${COR_DO_SWOT[i]}` : ""}`}>
            <Campo valor={it.titulo} aoMudar={(v) => gravar(itens.map((x, k) => (k === i ? { ...x, titulo: v } : x)))} placeholder="Título" editavel={editavel} className="bv-titulo" />
            <Campo valor={it.texto} aoMudar={(v) => gravar(itens.map((x, k) => (k === i ? { ...x, texto: v } : x)))} placeholder="Texto" editavel={editavel} multilinha />
          </div>
        ))}
      </div>
    </Isolado>
  );
}
const criarMatriz = createReactBlockSpec({ type: "matriz", propSchema: { dados: { default: JSON.stringify(SWOT) }, estilo: { default: "swot" } }, content: "none" }, { render: RenderDaMatriz });

// ── Pirâmide / Funil ──
const PADRAO_NIVEIS = ["Topo", "Meio", "Base"];
export function lerNiveis(bruto: string): string[] {
  const itens = lerLista(bruto, PADRAO_NIVEIS, (x) => (typeof x === "string" ? x.slice(0, CURTO) : null));
  return itens.length ? itens : PADRAO_NIVEIS;
}
function RenderDaPiramide(props: PropsDeRender) {
  const editavel = props.editor.isEditable;
  const niveis = lerNiveis(props.block.props.dados ?? "");
  const funil = props.block.props.forma === "funil";
  const gravar = (novos: string[]) => props.editor.updateBlock(props.block as never, { props: { dados: JSON.stringify(novos) } } as never);
  // Pirâmide: topo estreito e base larga; funil: o contrário. O primeiro nível fica em cima.
  const largura = (i: number) => { const n = niveis.length, passo = n > 1 ? i / (n - 1) : 0; return `${Math.round((funil ? 1 - passo * 0.6 : 0.4 + passo * 0.6) * 100)}%`; };
  return (
    <Isolado className="bv-bloco">
      {editavel ? (
        <div className="bv-barra">
          <button type="button" className="bv-texto-botao" onClick={() => props.editor.updateBlock(props.block as never, { props: { forma: funil ? "piramide" : "funil" } } as never)}>{funil ? "Forma: funil" : "Forma: pirâmide"}</button>
          {niveis.length < MAXIMO_DE_ITENS ? <BotaoPequeno aoClicar={() => gravar([...niveis, ""])} rotulo="Adicionar nível"><Plus size={12} /></BotaoPequeno> : null}
        </div>
      ) : null}
      <div className="bv-piramide">
        {niveis.map((nivel, i) => (
          <div key={i} className="bv-nivel" style={{ width: largura(i), opacity: 1 - i * (0.5 / Math.max(niveis.length, 1)) }}>
            <Campo valor={nivel} aoMudar={(v) => gravar(niveis.map((x, k) => (k === i ? v : x)))} placeholder="Nível" editavel={editavel} className="bv-centro" />
            {editavel && niveis.length > 1 ? <span className="bv-remover bv-remover--meio"><BotaoPequeno aoClicar={() => gravar(niveis.filter((_, k) => k !== i))} rotulo="Remover nível"><Trash size={12} /></BotaoPequeno></span> : null}
          </div>
        ))}
      </div>
    </Isolado>
  );
}
const criarPiramide = createReactBlockSpec({ type: "piramide", propSchema: { dados: { default: JSON.stringify(PADRAO_NIVEIS) }, forma: { default: "piramide" } }, content: "none" }, { render: RenderDaPiramide });

export const blocosVisuais = { destaque: criarDestaque(), fluxo: criarFluxo(), matriz: criarMatriz(), cartoes: criarCartoes(), metricas: criarMetricas(), piramide: criarPiramide() };

/** Os itens do menu "/" para criar cada um. */
export const ITENS_DOS_BLOCOS_VISUAIS: Array<{ tipo: keyof typeof blocosVisuais; titulo: string; descricao: string; aliases: string[] }> = [
  { tipo: "destaque", titulo: "Destaque", descricao: "Caixa colorida de aviso, sucesso ou informação.", aliases: ["destaque", "aviso", "callout", "alerta"] },
  { tipo: "fluxo", titulo: "Fluxo", descricao: "Etapas ligadas por setas.", aliases: ["fluxo", "etapas", "processo", "passos"] },
  { tipo: "matriz", titulo: "Matriz 2x2 / SWOT", descricao: "Quatro quadrantes com título e texto.", aliases: ["matriz", "swot", "quadrantes", "2x2"] },
  { tipo: "cartoes", titulo: "Cartões", descricao: "Cartões lado a lado com título e texto.", aliases: ["cartoes", "cards", "colunas"] },
  { tipo: "metricas", titulo: "Métricas", descricao: "Números grandes com legenda.", aliases: ["metricas", "numeros", "kpi", "indicadores"] },
  { tipo: "piramide", titulo: "Pirâmide / Funil", descricao: "Níveis empilhados, em pirâmide ou funil.", aliases: ["piramide", "funil", "niveis"] },
];
