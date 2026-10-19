# Design system da Frota

A Frota usa a mesma linguagem visual do **CRM M1 Growth**, com uma troca só: a cor de destaque deixa de ser o verde-petróleo Sage (`#366D6F`) e passa a ser o **Azul Frota (`#3366A0`)**. Tudo o mais (fundos, textos, bordas, cores de estado, fontes, ícones, cantos, sombras e o desenho do menu) é o do CRM.

- Código: `frota/web/static/app.css` (tokens e componentes), `frota/web/templates/_ui.html` (ícone e etiqueta de status).
- Vitrine ao vivo: a tela **Design system** no menu (`/design`) mostra cada peça nos temas claro e escuro.

## A ideia

O CRM foi desenhado para quem passa 8 horas por dia na frente da tela, e a frota tem o mesmo uso. Por isso o estilo é **calmo**:

1. **Clareza antes de enfeite.** Sem gradiente, sem vidro fosco, sem sombra decorativa. Se um elemento não informa nada, ele sai.
2. **Uma cor de destaque só.** O azul marca o que é clicável e o que está ativo. Fundos e textos são cinzas frios.
3. **Repetição.** Os mesmos botões, campos e etiquetas em todas as telas, com poucas variações e todas com nome.
4. **Acessível.** Contraste mínimo WCAG AA, anel de foco sempre visível, alvos de 44px no celular.
5. **Arejado.** Espaço em branco é respiro, não desperdício.

## Cores

### Azul Frota (11 tons)

| Tom | Hex | Uso |
|---|---|---|
| 50 | `#F0F6FD` | |
| 100 | `#DCEAFA` | fundo suave de destaque (etiqueta, item com foco) |
| 200 | `#BAD4F3` | |
| 300 | `#8DB6E6` | hover no tema escuro |
| 400 | `#6499D8` | **cor principal no tema escuro** |
| 500 | `#4680C3` | anel de foco |
| 600 | `#3366A0` | **cor principal no tema claro** (botão, link, item ativo) |
| 700 | `#2C527E` | hover no tema claro |
| 800 | `#264365` | |
| 900 | `#233954` | |
| 950 | `#101D2D` | |

Os tons não foram escolhidos a olho: saem da mesma conta que o CRM usa para trocar a cor da marca (`lib/branding/rampa.ts`, `rampaDeSemente("#3366a0")`). O azul tem a mesma luminosidade do Sage no tom 600, então o contraste de botão e link fica igual ao do CRM: **5,9 : 1** sobre branco e **6,2 : 1** (tom 400) sobre o fundo escuro.

### Neutros e superfícies

| Papel | Claro | Escuro |
|---|---|---|
| Fundo da página | `#F4F6F9` | `#0F151D` |
| Cartão | `#FFFFFF` | `#151D27` |
| Superfície elevada | `#EEF1F5` | `#1D2733` |
| Texto | `#141B24` | `#EEF2F6` |
| Texto suave | `#525F6E` | `#8B98A8` |
| Texto sutil | `#7A8795` | `#657386` |
| Borda | `#E2E7ED` | `#27323F` |
| Borda forte | `#CFD7E0` | `#344254` |

O tema escuro é desenhado à parte, não é o claro invertido. Ele segue o sistema operacional, e o botão de lua no pé do menu força um dos dois (fica salvo no navegador).

### Estados

| Estado | Cor (claro) | Uso na frota |
|---|---|---|
| Sucesso | `#5A8A5F` | Disponível, Ativo, linha ok na colagem |
| Atenção | `#B07A2B` | Manutenção, vencimentos próximos |
| Erro | `#A94A3C` | Sinistrado, Cancelado, falhas |
| Informação | `#4A7A93` | Documento gerado, Enviado p/ assinatura, avisos |
| Destaque (azul) | `#3366A0` | Em comodato, Assinado |
| Neutro | cinza | Baixado, Rascunho, Encerrado |

Cor nunca é a única informação: toda etiqueta tem o texto do status escrito.

## Tipografia

- **Montserrat** em toda a interface, com **Atkinson Hyperlegible** de reserva (a mesma pilha do CRM M1).
- **IBM Plex Mono** para placa, número de comodato, data, ano e documento: os números ficam alinhados em coluna.
- Os arquivos das fontes ficam no próprio sistema (`frota/web/static/fonts/`), então a tela não depende de internet para carregar.

| Nome | Tamanho / altura da linha | Peso | Uso |
|---|---|---|---|
| Título da página (`h1`) | 24 / 32 | 700 | "Veículos", "Comodatos" |
| Título de seção (`h2`) | 18 / 24 | 700 | |
| Título de cartão (`h3`) | 15 / 22 | 600 | "Adicionar veículo", "Histórico" |
| Texto | 14 / 20 | 400 | padrão de tudo |
| Legenda (`.caption`) | 12 / 16 | 400 | data, ajuda, rótulo pequeno |
| Dado (`.num`, `.mono`) | 13 | 400 | placa, número, data |

## Espaço, cantos e sombras

- Espaço em múltiplos de 4px: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Cantos: 6px (botão e campo), 10px (aviso), 16px (cartão), 12px (item do menu), redondo (etiqueta e filtro).
- Sombras em cinza azulado bem leve, nunca preto puro. Cartão usa a menor (`xs`); a gaveta do menu no celular usa a maior.

## Ícones

**Phosphor Icons**, como no CRM: traço `regular` no menu e nos botões, versão **preenchida** no item ativo do menu. Ficam todos num arquivo só (`frota/web/static/icones.svg`) e entram na tela com:

```jinja
{% from "_ui.html" import icone %}
{{ icone("car") }}
```

Para um ícone novo, copie o `<symbol>` do pacote `@phosphor-icons/core` (pastas `regular` e `fill`) para dentro de `icones.svg`. O teste `test_arquivos_do_design_system_existem` reprova se uma tela pedir um ícone que não está no arquivo.

## Componentes

| Peça | Classe | Observação |
|---|---|---|
| Menu lateral | `.lateral`, `.menu a`, `.on` | item ativo: fundo branco, sombra leve, barrinha azul de 3px à esquerda e ícone preenchido em azul. No celular vira gaveta aberta pelo botão ☰ |
| Cabeçalho da página | `.cabecalho` | título + frase curta embaixo, ação principal à direita |
| Cartão | `.card` | toda área de conteúdo mora num cartão |
| Botão principal | `button`, `.btn` | azul; um por área, no máximo |
| Botão secundário | `.sec` | cinza com borda; fica azul no hover |
| Botão fantasma | `.fantasma` | sem fundo; para barra de ferramentas |
| Botão de perigo | `.perigo` | vermelho; só para ação destrutiva |
| Tamanhos | `.pequeno`, `.icone-so` | 36px no computador, 44px no celular |
| Campo | `input`, `select`, `textarea` | fundo da página, borda fina, foco azul com halo suave |
| Tabela | `table`, `td.num` | cabeçalho em maiúsculas pequenas, linha realça no hover |
| Etiqueta de status | `{{ status("disponivel") }}` | pílula com ponto; a cor sai do status (ver tabela de estados) |
| Filtro em pílula | `.chip`, `.on` | contagem em fonte de dado |
| Aviso | `.msg`, `.sucesso`, `.alerta`, `.erro` | com ícone à esquerda |
| Estado vazio | `.vazio` | ícone grande cinza + frase do que fazer |
| Indicador | `.indicador .valor` | número grande para painéis |

## O que não fazer (herdado do CRM)

- Gradiente em botão ou cabeçalho.
- Efeito de vidro fosco (`backdrop-filter: blur`).
- Azul como fundo de área grande (menu inteiro azul, por exemplo). O menu é cinza; o azul só marca o item ativo.
- Vermelho puro saturado (`#EF4444`) para erro; use o vermelho do sistema.
- Ícone de "brilhinho" (sparkle) para coisas automáticas.
- Inventar tamanho de fonte fora da tabela acima.
- Cor escrita direto no HTML: use sempre as variáveis `--color-*`.
