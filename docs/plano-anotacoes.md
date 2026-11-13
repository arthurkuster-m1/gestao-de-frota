# Anotações — como o módulo funciona

Bloco de notas em páginas e subpáginas, no estilo Notion. Tela: `web/src/pages/anotacoes/`. Regras e dados: `web/src/lib/anotacoes/`.

## Páginas e árvore
- Tabela `notes_pages` (migration `20261210000040_anotacoes.sql`): árvore por `parent_id` + `position` (ponto médio entre vizinhas), lixeira por `deleted_at`, trava no banco contra ciclo e profundidade > 12.
- `notes_user_state`: favorita / última abertura, só da própria pessoa.
- A página aberta fica no endereço (`?p=`). Salva sozinha 0,9 s depois da última mudança e ao sair da página.
- Existe uma página "caixa de entrada" (`kind = 'inbox'`) criada no banco; a tela ainda não tem o botão para ela (fica para depois, junto com mover página).

## O editor (Tiptap v3)
- Arquivos: `EditorDeNotas.tsx` (editor e barras), `MenuSlash.tsx` (menu "/"), `SubpaginaNo.tsx` (cartão de subpágina), `AlcaDeArrastar.tsx` (alça), `editor-de-notas.css`.
- **Carregamento sob demanda:** `EditorCarregavel.tsx` usa `React.lazy`; o editor (~534 KB, 168 KB comprimido) só baixa quando alguém abre uma página.
- Blocos: texto, títulos 1–3, lista de tarefas, lista com marcadores, lista numerada, toggle, tabela (com cabeçalho), citação, código, divisor e subpágina. Sem imagem, vídeo, áudio, arquivo nem blocos visuais.
- Menu "/" (sem acento, setas/Enter/Tab, Esc fecha, `allowSpaces: false`). Barra de formatação ao selecionar texto (negrito, itálico, sublinhado, riscado, código, link) e barra da tabela quando o cursor está nela.
- Alça de arrastar própria (a extensão oficial puxaria o Yjs). Some em telas sem mouse.
- Subpágina = nó `subpagina` (`attrs.pageId`). O título/ícone do cartão vêm da árvore. Cartão que some do texto manda a subpágina para a lixeira (com "Desfazer"); a ordem dos cartões é a ordem na lateral. Ao abrir, o documento é ajustado às filhas vivas (`ajustarCartoes`).
- O documento sempre termina com um parágrafo vazio (`terminarComParagrafo`).
- `enableContentCheck`: se o editor não entende o conteúdo, a página abre só para leitura e nada é gravado por cima.
- Links: só `http`, `https`, `mailto` e `tel`; em página só de leitura, ou com Ctrl/⌘, o clique abre.

## Formato dos dados (sem migration)
- Coluna `blocks` (jsonb): o `content` do documento Tiptap (lista de nós, sem ids), até 400 KB.
- `documento.ts` → `lerDocumento`: detecta o formato antigo (blocos do BlockNote com `id`), converte com `legado.ts` e passa por `sanear.ts`. A página só é regravada se a pessoa editar.
- `legado.ts`: itens de lista seguidos viram uma lista só (aninhados vão para dentro do item); toggle vira `details`; tabela mantém o cabeçalho; estilos viram marcas; link perigoso vira texto; blocos visuais viram citação/títulos/parágrafos/lista com o mesmo texto.
- `sanear.ts`: abre nó desconhecido (o conteúdo fica), tira marca desconhecida e link perigoso, limita título a 1–3 e a profundidade.
- Busca: `busca.ts` achata o texto, sem acento; colunas `search_text`, `search_fold`, `title_fold` mantidas pelo cliente.
