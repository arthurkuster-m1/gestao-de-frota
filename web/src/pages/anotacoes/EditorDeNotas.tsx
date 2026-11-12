import "@blocknote/mantine/style.css";
import "./editor-de-notas.css";
import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems, getDefaultSlashMenuItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import * as locales from "@blocknote/core/locales";
import { SuggestionMenuController, createReactBlockSpec, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { FileText } from "@phosphor-icons/react";
import { ajustarCartoes, cartoesDoDocumento, type Documento } from "../../lib/anotacoes/documento";
import { ITENS_DOS_BLOCOS_VISUAIS, blocosVisuais } from "./blocos-visuais";
import type { ResumoDaNota } from "../../lib/anotacoes/paginas";

/** O que o cartão de subpágina precisa saber da árvore (o título e o ícone mudam fora do editor). */
interface ContextoDasSubpaginas { paginas: readonly ResumoDaNota[]; abrir: (id: string) => void }
const Contexto = createContext<ContextoDasSubpaginas>({ paginas: [], abrir: () => undefined });

function CartaoDeSubpagina({ pageId }: { pageId: string }) {
  const { paginas, abrir } = useContext(Contexto);
  const pagina = paginas.find((p) => p.id === pageId && !p.deleted_at);
  if (!pagina) return null;
  return (
    <button type="button" contentEditable={false} className="an-subpagina" onClick={() => abrir(pageId)}>
      {pagina.icon ? <span style={{ fontSize: 18, lineHeight: 1 }}>{pagina.icon}</span> : <FileText size={18} aria-hidden />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pagina.title || "Sem título"}</span>
    </button>
  );
}

const criarSubpagina = createReactBlockSpec(
  { type: "subpagina", propSchema: { pageId: { default: "" } }, content: "none" },
  { render: (props) => <CartaoDeSubpagina pageId={props.block.props.pageId} /> },
);

// Sem imagem, vídeo, áudio nem arquivo: o app não guarda arquivos de anotações.
const { image: _i, video: _v, audio: _a, file: _f, ...blocosPermitidos } = defaultBlockSpecs;
const esquema = BlockNoteSchema.create({ blockSpecs: { ...blocosPermitidos, subpagina: criarSubpagina(), ...blocosVisuais } });
const SEM_ARQUIVOS = ["image", "video", "audio", "file"];

export interface PropsDoEditorDeNotas {
  /** O conteúdo salvo. Lido UMA vez, ao abrir (use `key={id}` para trocar de página). */
  inicial: Documento;
  editavel: boolean;
  paginas: readonly ResumoDaNota[];
  /** O id da página aberta: as subpáginas dela são as filhas na árvore. */
  paginaId: string;
  aoMudar: (documento: Documento) => void;
  aoAbrir: (id: string) => void;
  /** Cria uma subpágina nesta página e devolve o id (ou nulo se falhou). */
  aoCriarSubpagina: () => Promise<string | null>;
  /** O cartão foi tirado do texto: a subpágina vai para a lixeira. */
  aoRemoverSubpagina: (id: string) => void;
  /** A ordem dos cartões mudou: a barra lateral segue a mesma ordem. */
  aoReordenarSubpaginas: (ids: string[]) => void;
}

function temaAtual(): "light" | "dark" { return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; }

/**
 * O EDITOR DE ANOTAÇÕES, no estilo Notion: clique e escreva; "/" abre o menu de blocos; a alça arrasta blocos.
 * As SUBPÁGINAS são cartões dentro do texto, na ordem que você arrastar. O documento é guardado como o editor entrega.
 */
export default function EditorDeNotas({ inicial, editavel, paginas, paginaId, aoMudar, aoAbrir, aoCriarSubpagina, aoRemoverSubpagina, aoReordenarSubpaginas }: PropsDoEditorDeNotas) {
  const [tema, setTema] = useState(temaAtual);
  useEffect(() => {
    const o = new MutationObserver(() => setTema(temaAtual()));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => o.disconnect();
  }, []);

  // As filhas vivas desta página, na ordem da árvore: o documento é ajustado a elas ao abrir.
  const conteudo = useMemo(() => {
    const filhas = paginas.filter((p) => p.parent_id === paginaId && !p.deleted_at).sort((a, b) => a.position - b.position).map((p) => p.id);
    return ajustarCartoes(inicial, filhas);
    // Só ao abrir: depois, quem manda no documento é quem está digitando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editor = useCreateBlockNote({ schema: esquema, dictionary: locales.pt, initialContent: conteudo.length ? (conteudo as never) : undefined }, []);

  const anteriores = useRef<string[]>(cartoesDoDocumento(conteudo));
  const ordemAplicada = useRef<string>(JSON.stringify(anteriores.current));

  function aoAlterar() {
    const documento = editor.document as unknown as Documento;
    aoMudar(documento);
    const atuais = cartoesDoDocumento(documento);
    // Cartão que sumiu do texto = subpágina para a lixeira (arrastar só muda de lugar, não some).
    for (const id of anteriores.current) if (!atuais.includes(id)) aoRemoverSubpagina(id);
    anteriores.current = atuais;
    const ordem = JSON.stringify(atuais);
    if (ordem !== ordemAplicada.current) { ordemAplicada.current = ordem; aoReordenarSubpaginas(atuais); }
  }

  function itensDoMenu(consulta: string) {
    const itens = [
      ...getDefaultSlashMenuItems(editor)
        .filter((i) => !SEM_ARQUIVOS.includes(i.key))
        // A tabela já nasce com a primeira linha como cabeçalho destacado.
        .map((i) => i.key === "table"
          ? { ...i, onItemClick: () => {
              const linha = () => ({ cells: ["", "", ""] });
              insertOrUpdateBlockForSlashMenu(editor, { type: "table", content: { type: "tableContent", headerRows: 1, rows: [linha(), linha(), linha()] } } as never);
            } }
          : i),
      ...ITENS_DOS_BLOCOS_VISUAIS.map((b) => ({
        key: b.tipo, title: b.titulo, subtext: b.descricao, aliases: b.aliases, group: "Blocos visuais", icon: <FileText size={18} aria-hidden />,
        onItemClick: () => { insertOrUpdateBlockForSlashMenu(editor, { type: b.tipo } as never); },
      })),
      {
        key: "subpagina", title: "Subpágina", subtext: "Uma página dentro desta, como um cartão.", aliases: ["subpagina", "pagina", "page", "nova"], group: "Páginas",
        icon: <FileText size={18} aria-hidden />,
        onItemClick: async () => {
          const atual = editor.getTextCursorPosition().block;
          const id = await aoCriarSubpagina();
          if (!id) return;
          const vazio = atual.type === "paragraph" && Array.isArray(atual.content) && atual.content.length === 0;
          const cartao = [{ type: "subpagina" as const, props: { pageId: id } }];
          if (vazio) editor.replaceBlocks([atual], cartao as never); else editor.insertBlocks(cartao as never, atual, "after");
        },
      },
    ];
    return filterSuggestionItems(itens, consulta);
  }

  // ── Seleção de várias linhas: retângulo no espaço em branco; os blocos tocados ficam pintados ──
  const papel = useRef<HTMLDivElement | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [retangulo, setRetangulo] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const arrastou = useRef(false);

  useEffect(() => editor.onSelectionChange(() => {
    const ids = editor.getSelection()?.blocks.map((b) => b.id) ?? [];
    setSelecionados((atual) => ids.length > 1 ? (JSON.stringify(atual) === JSON.stringify(ids) ? atual : ids) : atual.length ? [] : atual);
  }), [editor]);

  /** O "papel" em branco (fora do texto dos blocos): só aí o arrasto desenha o retângulo. Em qualquer outro ponto o clique é do editor (foco e cursor). */
  const ehPapelEmBranco = (alvo: HTMLElement) => alvo === papel.current || alvo.classList.contains("bn-container") || alvo.classList.contains("bn-editor");
  /** O elemento que rola (a página da anotação), para rolar sozinho quando o arrasto chega na borda. */
  const quemRola = (el: HTMLElement | null): HTMLElement => { for (let x = el; x; x = x.parentElement) { const o = getComputedStyle(x).overflowY; if ((o === "auto" || o === "scroll") && x.scrollHeight > x.clientHeight) return x; } return (document.scrollingElement as HTMLElement) ?? document.documentElement; };

  function comecouArrasto(e: MouseEvent<HTMLDivElement>) {
    const caixa = papel.current;
    if (!editavel || !caixa || e.button !== 0) return;
    // Clique no texto, no marcador de lista, na tabela, num botão ou menu: é do editor (foco, cursor e seleção de texto normais).
    if (!ehPapelEmBranco(e.target as HTMLElement)) return;
    e.preventDefault();
    const rolagem = quemRola(caixa), ehJanela = rolagem === document.scrollingElement || rolagem === document.documentElement;
    const topoRolado = () => (ehJanela ? window.scrollY : rolagem.scrollTop);
    const x0 = e.clientX, yConteudo0 = e.clientY + topoRolado();   // o ponto de partida acompanha o conteúdo quando a página rola
    let mx = e.clientX, my = e.clientY, ultimoIntervalo = "";
    arrastou.current = false;
    const atualizar = () => {
      const y0 = yConteudo0 - topoRolado();
      if (!arrastou.current && Math.hypot(mx - x0, my - y0) < 4) return;
      arrastou.current = true;
      const base = caixa.getBoundingClientRect();
      const esquerda = Math.min(x0, mx), topo = Math.min(y0, my), largura = Math.abs(mx - x0), altura = Math.abs(my - y0);
      setRetangulo({ x: esquerda - base.left, y: topo - base.top, w: largura, h: altura });
      const dentro = [...caixa.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > esquerda && r.left < esquerda + largura && r.bottom > topo && r.top < topo + altura;
      });
      // Só os blocos mais externos tocados: o filho vai junto com o pai.
      const raizes = dentro.filter((el) => !dentro.some((o) => o !== el && o.contains(el)));
      const ids = raizes.map((el) => el.dataset.id!).filter(Boolean);
      const intervalo = ids.length > 1 ? `${ids[0]}→${ids[ids.length - 1]}` : "";
      if (intervalo === ultimoIntervalo) return;   // a seleção só é refeita quando muda de fato (arrastar fica leve)
      ultimoIntervalo = intervalo;
      setSelecionados(ids.length > 1 ? ids : []);
      if (ids.length > 1) editor.setSelection(ids[0]!, ids[ids.length - 1]!);
    };
    const mover = (ev: globalThis.MouseEvent) => { mx = ev.clientX; my = ev.clientY; atualizar(); };
    // chegou perto da borda de cima ou de baixo: a página rola sozinha para dar para selecionar blocos fora da tela
    const relogio = window.setInterval(() => {
      if (!arrastou.current) return;
      const area = ehJanela ? { top: 0, bottom: window.innerHeight } : rolagem.getBoundingClientRect();
      const passo = my < area.top + 48 ? -Math.ceil((area.top + 48 - my) / 4) : my > area.bottom - 48 ? Math.ceil((my - (area.bottom - 48)) / 4) : 0;
      if (passo) { if (ehJanela) window.scrollBy(0, passo); else rolagem.scrollTop += passo; atualizar(); }
    }, 16);
    const soltar = () => {
      window.removeEventListener("mousemove", mover); window.removeEventListener("mouseup", soltar); window.clearInterval(relogio);
      setRetangulo(null);
      if (arrastou.current) editor.focus();   // com o foco no editor, Delete/Backspace, copiar, recortar e arrastar a alça já valem para todos os blocos selecionados
    };
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  }

  // Clicar no "papel" abaixo do último bloco coloca o cursor no fim, num parágrafo vazio.
  function clicouNoPapel(e: MouseEvent<HTMLDivElement>) {
    if (!editavel || !ehPapelEmBranco(e.target as HTMLElement)) return;
    if (arrastou.current) { arrastou.current = false; return; }
    // só vale no branco ABAIXO do último bloco (nas margens de cima/lados o clique não cria parágrafo)
    const blocosNaTela = papel.current?.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]");
    const fimDoTexto = blocosNaTela?.length ? Math.max(...[...blocosNaTela].map((b) => b.getBoundingClientRect().bottom)) : 0;
    if (e.target !== papel.current && e.clientY <= fimDoTexto) return;
    const blocos = editor.document;
    const ultimo = blocos[blocos.length - 1];
    if (!ultimo) return;
    const vazio = ultimo.type === "paragraph" && Array.isArray(ultimo.content) && ultimo.content.length === 0;
    if (vazio) editor.setTextCursorPosition(ultimo, "end");
    else { const [novo] = editor.insertBlocks([{ type: "paragraph" }], ultimo, "after"); if (novo) editor.setTextCursorPosition(novo, "end"); }
    editor.focus();
  }

  return (
    <Contexto.Provider value={{ paginas, abrir: aoAbrir }}>
      <div ref={papel} className={`an-editor ${selecionados.length > 1 ? "notas-varios-selecionados" : ""}`} style={{ position: "relative", minHeight: "40vh", cursor: "text", paddingBottom: 96 }} onClick={clicouNoPapel} onMouseDown={comecouArrasto}>
        {selecionados.length > 1 ? (
          <style>{selecionados.filter((id) => /^[\w-]+$/.test(id)).map((id) => `.bn-block-outer[data-id="${id}"]>.bn-block{background:rgb(100 160 255 / .18);border-radius:4px}`).join("")}</style>
        ) : null}
        {retangulo ? <div className="notas-retangulo" style={{ left: retangulo.x, top: retangulo.y, width: retangulo.w, height: retangulo.h }} /> : null}
        <BlockNoteView editor={editor} editable={editavel} theme={tema} slashMenu={false} onChange={aoAlterar}>
          <SuggestionMenuController triggerCharacter="/" getItems={async (consulta) => itensDoMenu(consulta)} />
        </BlockNoteView>
      </div>
    </Contexto.Provider>
  );
}
