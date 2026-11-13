import "./editor-de-notas.css";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect, useMemo, useRef, useState } from "react";
import { ajustarCartoes, cartoesDoDocumento, terminarComParagrafo, type Documento } from "../../lib/anotacoes/documento";
import { linkSeguro } from "../../lib/anotacoes/sanear";
import type { ResumoDaNota } from "../../lib/anotacoes/paginas";
import { AlcaDeArrastar } from "./AlcaDeArrastar";
import { criarMenuSlash, type ItemDoMenu } from "./MenuSlash";
import { ContextoSubpaginas, Subpagina } from "./SubpaginaNo";

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
  /** Entrega ao dono da página os atalhos do cursor: `inicio` (primeira linha) e `fim` (último bloco; cria uma linha nova se o último tem conteúdo). */
  /** Sem subpáginas (ex.: anotações do evento): tira o item do menu "/". */
  semSubpaginas?: boolean;
  aoPronto?: (cursor: { inicio: () => void; fim: () => void }) => void;
}

/** Os blocos do menu "/". */
function itensDoMenu(criarSubpagina: () => Promise<string | null>, semSubpaginas?: boolean): ItemDoMenu[] {
  const bloco = (titulo: string, descricao: string, apelidos: string[], rodar: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>): ItemDoMenu => ({
    titulo, descricao, apelidos, executar: (editor, intervalo) => { rodar(editor.chain().focus().deleteRange(intervalo)).run(); },
  });
  const itens: ItemDoMenu[] = [
    bloco("Texto", "Um parágrafo simples.", ["texto", "paragrafo", "p"], (c) => c.setParagraph()),
    bloco("Título 1", "Título grande.", ["titulo", "h1", "cabecalho"], (c) => c.setHeading({ level: 1 })),
    bloco("Título 2", "Título médio.", ["titulo", "h2", "cabecalho"], (c) => c.setHeading({ level: 2 })),
    bloco("Título 3", "Título pequeno.", ["titulo", "h3", "cabecalho"], (c) => c.setHeading({ level: 3 })),
    bloco("Lista de tarefas", "Itens com caixinha de marcar.", ["tarefa", "todo", "checkbox", "checklist"], (c) => c.toggleTaskList()),
    bloco("Lista com marcadores", "Uma lista com bolinhas.", ["marcadores", "bullet", "lista"], (c) => c.toggleBulletList()),
    bloco("Lista numerada", "Uma lista com números.", ["numerada", "numeros", "lista"], (c) => c.toggleOrderedList()),
    {
      titulo: "Toggle", descricao: "Um título que abre e fecha o conteúdo.", apelidos: ["toggle", "recolher", "detalhes", "sanfona"],
      // Nasce aberto, com o cursor no título.
      executar: (editor, intervalo) => { editor.chain().focus().deleteRange(intervalo).setDetails().updateAttributes("details", { open: true }).run(); },
    },
    bloco("Tabela", "Linhas e colunas, com cabeçalho.", ["tabela", "table", "grade"], (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true })),
    bloco("Citação", "Um trecho em destaque.", ["citacao", "quote", "aspas"], (c) => c.toggleBlockquote()),
    bloco("Código", "Um bloco de código.", ["codigo", "code", "programacao"], (c) => c.toggleCodeBlock()),
    bloco("Divisor", "Uma linha separando partes.", ["divisor", "linha", "separador", "hr"], (c) => c.setHorizontalRule()),
    {
      titulo: "Subpágina", descricao: "Uma página dentro desta, como um cartão.", apelidos: ["subpagina", "pagina", "page", "nova"],
      executar: async (editor, intervalo) => {
        editor.chain().focus().deleteRange(intervalo).run();
        const id = await criarSubpagina();
        if (!id) return;
        editor.chain().focus().insertContent({ type: "subpagina", attrs: { pageId: id } }).run();
        // O cursor vai para a linha depois do cartão (sempre há uma: o documento termina em parágrafo vazio).
        editor.commands.setTextSelection(editor.state.selection.to);
      },
    },
  ];
  return semSubpaginas ? itens.filter((i) => i.titulo !== "Subpágina") : itens;
}

const BOTAO = (ativo: boolean) => `an-barra__botao${ativo ? " is-ativo" : ""}`;

function BarraDeFormatacao({ editor }: { editor: Editor }) {
  const [, forcar] = useState(0);
  useEffect(() => { const f = () => forcar((n) => n + 1); editor.on("transaction", f); return () => { editor.off("transaction", f); }; }, [editor]);
  const ligar = () => {
    const atual = (editor.getAttributes("link").href as string | undefined) ?? "";
    const dado = window.prompt("Endereço do link (http, https, mailto ou tel). Deixe vazio para tirar o link:", atual);
    if (dado === null) return;
    const limpo = dado.trim();
    if (!limpo) { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    const url = /^[a-z][a-z0-9+.-]*:/i.test(limpo) ? limpo : `https://${limpo}`;
    if (!linkSeguro(url)) { window.alert("Esse endereço não é aceito. Use http, https, mailto ou tel."); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  const b = (rotulo: string, marca: string, rodar: () => void, texto: React.ReactNode) => (
    <button type="button" aria-label={rotulo} title={rotulo} aria-pressed={editor.isActive(marca)} className={BOTAO(editor.isActive(marca))} onMouseDown={(e) => e.preventDefault()} onClick={rodar}>{texto}</button>
  );
  return (
    <div className="an-barra" role="toolbar" aria-label="Formatação do texto">
      {b("Negrito", "bold", () => editor.chain().focus().toggleBold().run(), <strong>N</strong>)}
      {b("Itálico", "italic", () => editor.chain().focus().toggleItalic().run(), <em>I</em>)}
      {b("Sublinhado", "underline", () => editor.chain().focus().toggleUnderline().run(), <u>S</u>)}
      {b("Riscado", "strike", () => editor.chain().focus().toggleStrike().run(), <s>R</s>)}
      {b("Código", "code", () => editor.chain().focus().toggleCode().run(), <code>{"</>"}</code>)}
      {b("Link", "link", ligar, "Link")}
    </div>
  );
}

function BarraDaTabela({ editor }: { editor: Editor }) {
  const a = (rotulo: string, rodar: () => void) => <button key={rotulo} type="button" className="an-barra__botao" onMouseDown={(e) => e.preventDefault()} onClick={rodar}>{rotulo}</button>;
  return (
    <div className="an-barra" role="toolbar" aria-label="Tabela">
      {a("+ Linha", () => editor.chain().focus().addRowAfter().run())}
      {a("+ Coluna", () => editor.chain().focus().addColumnAfter().run())}
      {a("− Linha", () => editor.chain().focus().deleteRow().run())}
      {a("− Coluna", () => editor.chain().focus().deleteColumn().run())}
      {a("Apagar tabela", () => editor.chain().focus().deleteTable().run())}
    </div>
  );
}

/**
 * O EDITOR DE ANOTAÇÕES (Tiptap), no estilo Notion: clique e escreva; "/" abre o menu de blocos;
 * a alça à esquerda arrasta blocos; ao selecionar texto aparece a barra de formatação.
 * As SUBPÁGINAS são cartões dentro do texto, na ordem que você arrastar.
 * É carregado só quando alguém abre uma página (ver `EditorCarregavel`).
 */
export default function EditorDeNotas({ inicial, editavel, paginas, paginaId, aoMudar, aoAbrir, aoCriarSubpagina, aoRemoverSubpagina, aoReordenarSubpaginas, aoPronto, semSubpaginas }: PropsDeEditor) {
  // As filhas vivas desta página, na ordem da árvore: o documento é ajustado a elas ao abrir.
  const conteudo = useMemo(() => {
    const filhas = paginas.filter((p) => p.parent_id === paginaId && !p.deleted_at).sort((a, b) => a.position - b.position).map((p) => p.id);
    return terminarComParagrafo(ajustarCartoes(inicial, filhas));
    // Só ao abrir: depois, quem manda no documento é quem está digitando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anteriores = useRef<string[]>(cartoesDoDocumento(conteudo));
  const ordemAplicada = useRef<string>(JSON.stringify(anteriores.current));
  const [bloqueado, setBloqueado] = useState(false);
  // Os avisos do editor sempre usam a versão mais nova das funções da tela.
  const semSubpaginasRef = useRef(semSubpaginas);
  const ref = useRef({ aoMudar, aoCriarSubpagina, aoRemoverSubpagina, aoReordenarSubpaginas });
  ref.current = { aoMudar, aoCriarSubpagina, aoRemoverSubpagina, aoReordenarSubpaginas };

  const extensoes = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, isAllowedUri: (url: string) => linkSeguro(url) },
    }),
    TaskList,
    TaskItem.configure({ nested: true, a11y: { checkboxLabel: (node, marcado) => `${marcado ? "Feita" : "A fazer"}: ${node.textContent || "tarefa vazia"}` } }),
    TableKit.configure({ table: { resizable: false } }),
    Details.configure({ persist: true, renderToggleButton: ({ element, isOpen }) => { element.setAttribute("aria-label", isOpen ? "Recolher" : "Expandir"); element.setAttribute("aria-expanded", String(isOpen)); } }),
    DetailsSummary,
    DetailsContent,
    Placeholder.configure({
      showOnlyCurrent: true, includeChildren: true,
      placeholder: ({ node }) => node.type.name === "heading" ? `Título ${node.attrs.level as number}` : node.type.name === "detailsSummary" ? "Título do toggle" : "Escreva ou digite “/” para ver os blocos…",
    }),
    Subpagina,
    criarMenuSlash(() => itensDoMenu(() => ref.current.aoCriarSubpagina(), semSubpaginasRef.current)),
  ], []);

  const editor = useEditor({
    extensions: extensoes,
    content: { type: "doc", content: conteudo },
    editable: editavel,
    // Conteúdo que o editor não entende: abre só para leitura (nunca grava por cima).
    enableContentCheck: true,
    onContentError: () => setBloqueado(true),
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: "an-prosa", "aria-label": "Texto da página", spellcheck: "true" },
      handleClick: (view, _pos, evento) => {
        const link = (evento.target as HTMLElement | null)?.closest?.("a");
        if (!link) return false;
        // Em página só de leitura, ou com Ctrl/⌘, o clique abre o link.
        if (!view.editable || evento.ctrlKey || evento.metaKey) {
          const href = link.getAttribute("href");
          if (href && linkSeguro(href)) window.open(href, "_blank", "noopener,noreferrer");
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      const documento = (e.getJSON().content ?? []) as Documento;
      ref.current.aoMudar(documento);
      const atuais = cartoesDoDocumento(documento);
      // Cartão que sumiu do texto = subpágina para a lixeira (arrastar só muda de lugar, não some).
      for (const id of anteriores.current) if (!atuais.includes(id)) ref.current.aoRemoverSubpagina(id);
      anteriores.current = atuais;
      const ordem = JSON.stringify(atuais);
      if (ordem !== ordemAplicada.current) { ordemAplicada.current = ordem; ref.current.aoReordenarSubpaginas(atuais); }
    },
  });

  useEffect(() => { editor?.setEditable(editavel && !bloqueado); }, [editor, editavel, bloqueado]);

  useEffect(() => {
    if (!editor) return;
    aoPronto?.({
      inicio: () => { if (editor.isEditable) editor.chain().focus("start").run(); },
      fim: () => {
        if (!editor.isEditable) return;
        const ultimo = editor.state.doc.lastChild;
        // Se o último bloco já tem conteúdo, abre uma linha nova logo abaixo.
        if (ultimo && !(ultimo.type.name === "paragraph" && ultimo.content.size === 0)) editor.chain().focus("end").insertContentAt(editor.state.doc.content.size, { type: "paragraph" }).focus("end").run();
        else editor.chain().focus("end").run();
      },
    });
  }, [editor, aoPronto]);

  const caixa = useRef<HTMLDivElement | null>(null);
  if (!editor) return null;
  return (
    <ContextoSubpaginas.Provider value={{ paginas, abrir: aoAbrir }}>
      {bloqueado ? <p className="an-aviso-editor" role="alert">Esta página tem um conteúdo que o editor não entende. Ela foi aberta só para leitura, e nada será gravado por cima.</p> : null}
      <div ref={caixa} className="an-editor" data-testid="editor-de-notas">
        <AlcaDeArrastar editor={editor} caixa={caixa} />
        <EditorContent editor={editor} />
        <BubbleMenu editor={editor} shouldShow={({ editor: e, state }) => e.isEditable && !state.selection.empty && !e.isActive("subpagina") && state.selection.constructor.name !== "NodeSelection" && !e.isActive("codeBlock")}>
          <BarraDeFormatacao editor={editor} />
        </BubbleMenu>
        <BubbleMenu editor={editor} options={{ placement: "top" }} shouldShow={({ editor: e, state }) => e.isEditable && state.selection.empty && e.isActive("table")}>
          <BarraDaTabela editor={editor} />
        </BubbleMenu>
      </div>
    </ContextoSubpaginas.Provider>
  );
}
type PropsDeEditor = PropsDoEditorDeNotas;
