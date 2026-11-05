# CONTEXTO-FROTA — leia isto primeiro

Passagem de bastão entre sessões do Claude. Escrito em 05/11/2026, no fim da sessão que montou o protótipo em Python, e **atualizado no mesmo dia com as decisões do Arthur** (seção 0).
Se algo aqui contradisser o que o Arthur disser hoje, vale o que ele disser, e este arquivo deve ser corrigido.

## 0. Decisões do Arthur em 05/11/2026 (valem sobre o resto do documento)

1. **Caminho A:** refazer a Frota **na mesma stack do `familia-kuster`**: React + TypeScript + Supabase, publicada no **Cloudflare Pages**, sem VPS. Ele foi avisado de que isso **abandona "majoritariamente Python"** e o "100% local no PC", e aceitou. O protótipo Python **não recebe mais funcionalidade grande**: vira **referência de regras** (colagem do Excel, status, cálculos do Início, mapeamento do Word) e de aparência.
2. **Supabase:** o banco antigo do CRM (`M1-Growth-CRM-dev-pc`) tinha **só dados de teste**, sem necessidade de backup. **Foi pausado** nesta sessão (status `INACTIVE`) e o Arthur **vai excluí-lo no painel** (Settings › General › Delete project). Nada foi apagado por nós.
3. **Projeto novo `frota` criado** (São Paulo, ref `hqivwljmjnagjuxzdanj`, URL `https://hqivwljmjnagjuxzdanj.supabase.co`). A senha do banco foi gerada pelo Supabase e **ninguém a conhece**: o Arthur precisa redefini-la no painel. O projeto `Família Kuster` **não foi tocado**.
4. **O núcleo do banco (com RLS) está escrito, validado e testado, mas NÃO aplicado.** O Supabase pede a aprovação do Arthur na tela para o assistente aplicar migration, e o pedido expirou (60 s). Tudo está em `supabase/` (`migrations/20261105000001_core_workspaces.sql`, `seed.example.sql`, `tests/rls-core.sql`, `README.md` com o passo a passo). Validado num Postgres 16 descartável: aplica duas vezes sem quebrar, a semente não duplica, o teste de isolamento passa, e **falha de verdade** quando a política é aberta ou a função fica exposta a `anon`. **Ainda não rodou no Supabase real.** Primeira tarefa da próxima sessão: confirmar com o Arthur que ele aplicou (`list_migrations` deve listar o núcleo), rodar `get_advisors` (security) e seguir.
5. **A VPS antiga NÃO ficará no ar.** O protótipo Python (`frota.infra-assessoria-m1.cloud`) vai cair. **Antes de desligar**, o Arthur pode baixar o que for útil: os **modelos Word** que ele enviou (`/var/lib/frota/arquivos/modelos/`) e, se houver algo que valha, `/var/lib/frota/frota.sqlite` (`scp -r root@IP:/var/lib/frota/arquivos .`). Perguntar se ele já baixou os modelos Word: serão necessários para testar a geração de contrato na versão nova.
6. **Plano novo em [`docs/plano-app.md`](plano-app.md)** (05/11/2026): as especificações do Arthur (dois status do veículo, reserva por carro, transportes e pagamentos, checklists, contratos com aditivo, tela de Planejamento em linha do tempo) respondem as perguntas 1 e 3 e parte da 2 e da 5. **Vale o plano novo sobre a seção 9 abaixo.** Núcleo do banco aplicado pelo Arthur e conferido (tabelas com RLS, 1 linha em cada).
7. **Ainda pendentes:** ver seção 8 do `plano-app.md`.

## 1. Como trabalhar com o Arthur

- **Português simples, um passo de cada vez.** Ele **não é programador** (sabe landing page no Cloudflare Pages e n8n). Explique o efeito, não o mecanismo.
- **Acompanha pelo celular** e, muitas vezes, não está no computador. Entregue algo que ele consiga ver (artefato, link, captura de tela) e diga o que ele precisa fazer, em passos curtos.
- **Prove antes de afirmar.** Rode o que escreveu (testes, navegador de verdade, captura de tela) e diga o que **não** foi testado. Nesta sessão, vários defeitos só apareceram no navegador (foco perdido, altura de caixa antes da fonte carregar, cache de CSS).
- **Não apague nada sem confirmar**, nem em Supabase, nem em VPS, nem em repositório. Olhe o alvo antes.
- **Não crie PR sem ele pedir.** Commits e push na branch da sessão.
- Ele pede de forma corrida e por voz; reconstrua a intenção, e **pergunte só o que muda o que você faz**.
- Tom: direto, sem enfeite, sem emoji.

## 2. O que é o projeto

Software de **gestão de frota** do Arthur (frota de marketing de montadora: carros que saem para eventos e comodatos de longa duração). Um usuário só (ele). Escala: ~200 veículos e ~500 eventos/comodatos por ano.

Pedido original (módulos): veículos com ciclo de vida, modo inventário, eventos/comodatos, cadastro de clientes, envio e acompanhamento de assinatura (API D4Sign, **ainda sem acesso**; por enquanto o contrato sai em Word), multas (achar quem estava com o carro e o contato), sinistros, seguro, formulário de comodato (estilo Typeform).

Pedido mais recente (menu lateral): **Início**, **Veículos** (tabela estilo Notion), **Eventos** (tabela estilo Notion com linha do tempo), **Contratos de Comodato**, **Sinistros e Manutenções**, **Multas**, **Faturamentos**, **Devoluções**, **Dashboard financeiro**.

Restrições ditas pelo Arthur:
- **"Precisa ser majoritariamente escrito em Python"** (dito no início). Ver a decisão em aberto da seção 6: o caminho de nuvem que ele pediu agora pode contradizer isso, e ele ainda não decidiu com essa informação.
- **Usar os "motores" do CRM** (tabela/propriedades/visualizações estilo Notion, tarefas, editor de blocos).
- Começou querendo 100% local (SQLite no PC dele). Depois pediu para ver pelo celular e, por fim, **publicar no Cloudflare Pages ligado ao Supabase, sem VPS**.

## 3. Estado atual: protótipo em Python (funciona, no GitHub)

- Repositório `arthurkuster-m1/gestao-de-frota`, branch **`claude/fleet-management-software-rf1gki`** (último commit desta sessão: `6d1ebce`, mais o desta documentação). É público.
- **FastAPI + SQLAlchemy 2 + Jinja2**, SQLite (arquivo único), sem Node. 42 testes (`python -m pytest -q`).
- Rodar: `pip install -e ".[dev]"` e `frota` (ou `python -m frota.cli --port 8000`); dados em `./dados/` (variável `FROTA_DATA_DIR`).
- Código: `frota/{main,models,db,config,auth}.py`, `frota/services/{colagem,comodatos,documentos,inicio,paineis}.py`, `frota/web/{menu.py,templates/,static/}`, testes em `tests/`.

**O que já funciona**
- Login por senha única (`FROTA_SENHA`), bloqueio após 5 erros.
- **Veículos** (cadastro, filtro por status, histórico do ciclo de vida) e **Clientes**.
- **Comodatos em lote:** o Arthur cola a tabela do Excel; o sistema confere placa, disponibilidade e data, mostra o que está ok/com erro e cria. Colunas extras viram campos do modelo.
- **Modelos Word:** sobe um `.docx` com `{{ campos }}`; devolve o Word preenchido (um por comodato, ou ZIP). Campo desconhecido gera erro claro. Campo partido em pedaços pelo Word funciona (docxtpl).
- **Início:** saudação com frase do dia, valores (total, ativos, disponíveis, em evento, em comodato > 1 mês), calendário Dia/Semana/Mês com navegação por data, Avisos (painel lateral que recolhe; cada aviso é link), Próximos envios e retornos, Próximas tarefas (derivadas do andamento dos contratos), **Anotações** (editor de blocos) e **Infos contábeis** (painel que recolhe; grupos recolhíveis; copiar).
- **Editor de blocos das anotações:** junção dos dois editores do CRM (ver seção 8). Escreve direto, `/` com busca, markdown, blocos dentro de blocos, blocos visuais editados no lugar, alça com menu, seleção de blocos, Ctrl+Z. Feito em JavaScript puro (`frota/web/static/editor-blocos.js`).
- Páginas **Eventos, Sinistros e Manutenções, Multas, Devoluções, Faturamentos, Dashboard financeiro**: só a estrutura com "Em breve".
- Design system aplicado (seção 4), tema claro/escuro, celular com menu em gaveta.

**Regras provisórias que o Arthur ainda não validou**
- *Ativos* = veículos não baixados (a definição final sairia do motor de Veículos).
- *Em evento* vs *Em comodato*: comodato aberto até 30 dias = evento; mais que isso, ou sem data de volta = comodato.
- *Tarefas* ainda não são digitadas à mão; saem do status de cada comodato.

**Infra na VPS (protótipo no ar)**
- Kit em `deploy/` (`instalar-frota.sh`, `LEIA-ME.md`, serviço systemd `frota`, timers de atualização automática e backup diário). Código em `/opt/frota`, dados em `/var/lib/frota` (`frota.sqlite`), porta `127.0.0.1:8001`, domínio `frota.infra-assessoria-m1.cloud` atrás do Caddy, senha em `/etc/frota.env`.
- A VPS puxa a branch sozinha a cada 2 minutos.
- ⚠️ **Essa VPS é a antiga do CRM da agência.** O Arthur disse que migrou o CRM para outra VPS e outro Supabase. Confirmar com ele se a VPS antiga continua viva; se for desligada, o protótipo cai junto.
- Esta sessão **nunca teve acesso à VPS**; o que sabemos dela vem do que o Arthur colou (por exemplo, a senha de acesso é gerada lá). O passo a passo de instalação foi testado por partes, não numa VPS real.

## 4. Design system (já aplicado; mudou do documento original)

Fonte da verdade: `docs/design-system.md` (o Arthur mandou o original; foi ajustado depois). Resumo:
- Linguagem do CRM M1 com **Azul Frota `#3366A0`** como única cor de destaque (11 tons; 400 no escuro).
- **Só Montserrat** (decisão do Arthur: sem fonte monoespaçada; números com `tabular-nums`). Fontes dentro do projeto.
- **Botões em pílula**, campos com 12 px, cartões 16 px. Ícones Phosphor (arquivo único `static/icones.svg`, gerado por `scripts/gerar_icones.py`).
- **O `<select>` e o `<input type=date>` do navegador nunca aparecem**: `app.js` os troca por lista e calendário do app (`dd/mm/aaaa`, pt-BR).
- Conteúdo ocupa **toda a largura** ao lado do menu.
- Cor nunca escrita no HTML (sempre `var(--color-*)`); há teste que vigia.
- Os dois painéis laterais (Avisos e Infos) recolhem e lembram o estado.

## 5. Mapa Notion e decisões pendentes

`docs/notion-propriedades.md` = propriedades lidas dos bancos do Notion do Arthur (Veículos, Calendário de Uso, Eventos). `docs/mapa-funcionalidades.md` = o que cada página precisa, a ordem sugerida e as decisões abertas.

Resumo do modelo proposto: **Veículo**; **Evento** (o motivo do uso, agrupa saídas); **Saída** (cada ida de carro para um evento, com datas, transporte, valores, NF, situação em 14 etapas); **Contrato de Comodato** (o Word, nasce da Saída). Status do veículo tem 18 etapas, o da saída 14 (listas completas em `notion-propriedades.md`).

O que o motor de tabelas precisa ter que o do CRM **não** tem: relação, rollup, fórmula, status com grupos, título, moeda.

**Perguntas que o Arthur ainda não respondeu** (travam o motor de tabelas e os módulos seguintes):
1. Uma **Saída** é de um carro ou de vários? (Recomendação: uma linha por carro, agrupadas pelo Evento.)
2. O **contrato de comodato** é por carro ou por evento?
3. Os **18 status do veículo** ficam numa coluna só? (Misturam o caminho do 0 km, 01–08, com o uso na operação, 09–13; "Manutenção" e "Clonado/Gravame" estão no grupo "Concluído" mas o carro volta a circular.)
4. Pedir o banco **Sinistros** do Notion (não foi lido).
5. **Multas, Faturamentos e Devoluções** têm planilha/outra fonte, ou nascem do zero?

## 6. Caminho da nuvem (DECIDIDO: A; o texto abaixo é o raciocínio que levou a isso)

O Arthur quer, no fim, **publicar no Cloudflare Pages ligado ao Supabase, sem VPS** (continuando na VPS enquanto termina o sistema). Isso colide com "majoritariamente Python".

**Fatos verificados (busca na web, 05/11/2026)**
- Cloudflare **posiciona Workers com Static Assets como sucessor do Pages** para projetos novos (fontes secundárias; o Pages continua funcionando).
- **Python Workers** existem, dizem estar em GA, rodam **FastAPI**, usam **Pyodide** (Python em WebAssembly) e o sistema de arquivos é **efêmero, em memória** (dado durável vai em KV/R2/Durable Objects).
- **Hyperdrive** passou a suportar Python Workers (changelog de 16/09/2026) e, com Supabase, conecta direto ao Postgres.
- Nada encontrado sobre Python em **Pages Functions** (o que não prova que não exista, só que não achamos).

**Não verificado** (o subagente não conseguiu abrir `developers.cloudflare.com`: rede bloqueada nesta sessão)
- Se `lxml`, `python-docx` e `docxtpl` (base do nosso gerador de Word) rodam no Python Workers.
- Se o driver Postgres que usamos (SQLAlchemy + psycopg) funciona lá, via Hyperdrive.
- Limites de tamanho do pacote, de CPU e de memória.

**Opções**
- **A. Refazer na stack do `familia-kuster`** (React + TypeScript + Supabase, publicada no Pages). É o padrão que o Arthur já tem funcionando e já usa **Cloudflare Pages + Supabase**. O Word sai pelo navegador (biblioteca JS de modelo Word, a validar), a colagem do Excel pelo `papaparse` (já no projeto), o motor de tabelas e o editor de blocos **copiados do CRM** (que é React/TypeScript). Perde "Python" e "100% local no PC".
- **B. Manter Python**, rodando em Cloudflare **Python Worker** + Supabase por Hyperdrive. Precisa de um **teste de 1 dia** antes de se comprometer (itens não verificados acima) e exige trocar disco local por Supabase Storage.
- **C. Manter Python em servidor** (VPS ou outro host de contêiner) com Supabase como banco, e a Cloudflare só na frente (Tunnel + Access). Não é "Pages", mas não reescreve nada.

**Recomendação feita ao Arthur (a confirmar com ele):** A, porque (1) é o que ele descreveu (Pages + Supabase, sem VPS), (2) ele já tem o `familia-kuster` como modelo comprovado, com design system, grade tipo planilha, arrastar, importação CSV, backup automático e RLS testada, e (3) o motor de tabelas e o editor de blocos do CRM existem em React/TypeScript, então seriam **copiados em vez de reescritos**; foi isso, aliás, que mais custou nesta sessão (reimplementar o editor em JavaScript puro). Se ele mantiver "Python" como regra, fazer **B** (com o teste) ou **C**.
**Como é A:** parar de acrescentar funcionalidade grande ao protótipo Python (seria trabalho jogado fora) e usá-lo como **referência de regras** (colagem do Excel, status, cálculos do Início, mapeamento do Word) e de dados (um script exporta o SQLite para o Supabase).

## 7. Supabase (conta "Assessoria M1"): estado em 05/11/2026

- `frota` (`hqivwljmjnagjuxzdanj`, sa-east-1): **criado, vazio**; falta aplicar o núcleo (seção 0, item 4).
- `M1-Growth-CRM-dev-pc` (`fpxgtidrkcypzbsmchev`): **pausado**, a ser excluído pelo Arthur. Tinha dados de teste do CRM antigo. As chaves dele foram coladas em chats no passado: **nunca reaproveitar**.
- `Família Kuster` (`igbdikbrzpyxwrbxuzha`, us-east-1): banco do `familia-kuster`. **Não mexer.** (O painel marca esse projeto com canal de versão "withdrawn"; vale mostrar ao Arthur.)
- Plano gratuito: 2 projetos ativos (hoje: `frota` e `Família Kuster`).
- O MCP do Supabase **pede aprovação na tela** para `apply_migration` (expira em 60 s). Não contornar por `execute_sql`. Se o Arthur estiver no celular, dar o SQL para colar no *SQL Editor* ou pedir que ele esteja com a tela aberta na hora.
- Modelo de dados do núcleo: `workspaces`, `workspace_members` (um usuário, um espaço), funções `fn_my_workspaces()` e `fn_default_workspace()`; toda tabela de módulo leva `workspace_id` e a política "sou membro deste espaço". Segue o `familia-kuster` (lá se chama household).

## 8. Repositórios e o que reaproveitar

Sempre ler a **`main` do CRM** (`git show origin/main:caminho`), **não a branch atual do clone**: o clone local ficou atrasado em milhares de arquivos e a sessão anterior leu o editor errado por causa disso.

**`arthurkuster-m1/familia-kuster`** (privado; Vite + React 19 + TypeScript + Supabase, publicado no Cloudflare Pages)
- `docs/SETUP.md`: o passo a passo **Supabase → banco → usuários → Cloudflare Pages** que o Arthur já fez uma vez.
- `src/ds/` (design system em CSS puro com tokens: Button, Card, Combobox, DateFields, Select, Ordenavel…), `src/app/` (Shell, Sidebar, modules), `src/lib/{auth,supabase,backup}.ts`.
- `supabase/migrations/` (idempotentes, RLS por família com funções `fn_my_households`/`fn_default_household`, funções com `revoke` de `public`/`anon`), `supabase/tests/` (teste de RLS), `supabase/functions/bebe-push` (notificação push).
- `.github/workflows/backup.yml` (copia o banco para o Google Drive a cada 3 dias **e evita a pausa por inatividade**), `docs/BACKUP-AUTOMATICO.md`, `docs/RECUPERACAO.md`, botão "Baixar backup" no app.
- Dependências úteis já escolhidas: `react-datasheet-grid`, `@dnd-kit/*`, `papaparse`, `fflate`, `@phosphor-icons/react`, `vite-plugin-pwa`.
- Pendência dele: backup automático "combinado, ainda não ativado" (precisa de 4 segredos); 2 migrations não aplicadas; trocar a senha de teste. Não é da Frota, mas vale lembrar.

**CRM `arthurkuster-m1/M1-Growth-CRM-PC`, branch `main`**
- Motor de tabelas estilo Notion: `lib/motor/*` (consulta, filtros, ordenação, layout, visualizações), `components/motor/*` (tabela, barra de consulta, calendário, seletores), `lib/tarefas/propriedades.ts`, tabelas `crm_task_properties` e `crm_saved_views`.
- **Editor de blocos das notas (escreve direto, estilo Notion):** `components/editor/EditorDeBlocos.tsx` + `lib/tarefas/blocos.ts`.
- **Editor visual das estratégias:** `components/marketing/EditorVisualDeBlocos.tsx` + `lib/marketing/{blocos,edicao-de-blocos}.ts` e `BlocosRender.tsx`.
- Design system original: `docs/design-system*`; guia de doutrina em `CLAUDE.md` (multi-tenancy, migrations idempotentes, etc.).

## 9. Plano (atualizado: caminho A)

Legenda: ✅ feito · 🔶 pronto, falta o Arthur · ⬜ a fazer

0. ✅ Decidir o caminho da nuvem (A) e o destino do Supabase antigo.
1. 🔶 **Núcleo do banco** com RLS no projeto `frota`: escrito, validado e testado localmente; **falta o Arthur aplicar** (`supabase/README.md`, passos 1 a 6) e a gente conferir com `list_migrations` e `get_advisors`.
2. ⬜ **Esqueleto do app** na pasta nova (sugestão: `web/` no mesmo repositório, e o protótipo Python fica em `frota/` até arquivar), copiando do `familia-kuster`: `src/ds` (trocando o azul-marinho pelo **Azul Frota** `#3366A0` e as fontes pela **Montserrat**), Shell/Sidebar, auth, `supabase.ts`, PWA, backup. Menu lateral com as 9 telas e o "Em breve", como no protótipo.
3. ⬜ **Esquema do domínio** no Supabase (veículos, clientes, eventos, saídas, comodatos, painéis) com RLS e teste de isolamento por migration. **Depende das 5 perguntas do Notion** (seção 5), principalmente Saída de um carro ou de vários.
4. ⬜ **Trazer o que já existe**, usando o protótipo Python como especificação: Início (calendário, avisos, envios/retornos, tarefas), Veículos, colagem do Excel (`papaparse`), Word por modelo (biblioteca JS de modelo Word, a validar com os modelos reais do Arthur), anotações e infos contábeis (**editor React do CRM**, não reescrever).
5. ⬜ **Motor de tabelas** copiado do CRM (`lib/motor`, `components/motor`) com relação, rollup, fórmula, status com grupos, título e moeda; Veículos e Eventos nele.
6. ⬜ Contratos ligados à Saída; D4Sign quando houver acesso (por função do Supabase; a chave nunca no navegador).
7. ⬜ Devoluções, Faturamentos, Sinistros e Manutenções, Multas; por último o Dashboard financeiro.
8. ⬜ **Deploy** no Cloudflare Pages (conectar o GitHub; variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; Site URL no Supabase), seguindo o `docs/SETUP.md` do `familia-kuster`. Cloudflare recomenda **Workers com Static Assets** para projetos novos: conferir qual dos dois usar.
9. ⬜ **Backup automático** (copiar o `backup.yml` do `familia-kuster`; ele também evita o Supabase pausar por inatividade) e **segunda dona/dono** da conta, verificação em duas etapas.
10. ⬜ Importar os dados reais (se houver) e **desligar** o que sobrou do protótipo.

## 10. Armadilhas já pagas

- `pkill -f "texto"` num comando que contém esse texto **mata o próprio shell** (exit 144). Use PID em arquivo.
- Arquivo estático sem cache controlado mostra tela nova com CSS velho: as URLs de `app.css`/`app.js` têm `?v=<mtime>` (função `asset()`).
- Altura de `textarea` calculada **antes da fonte carregar** corta o texto: refazer em `document.fonts.ready` e com `ResizeObserver`.
- Em coluna `flex`, `flex:1` zera a altura automática da caixa de texto.
- Um clique dentro de um `<label>` que contém o seletor reabre a lista (o clique "vaza" para o rótulo): use `div`.
- Menu flutuante que fecha ao rolar some quando a seta para baixo rola a lista; e arrastar a barra do menu tira o foco do texto (`mousedown` com `preventDefault`).
- Link digitado como `javascript:` nunca pode virar link: o servidor completa `https://` ou descarta.
- Anotações já gravadas em formatos antigos são convertidas ao abrir (`migrar_blocos`); qualquer formato novo precisa de conversão equivalente e de teste.
- Playwright: o navegador está em `/opt/pw-browsers/chromium` (`executable_path`); instalar o pacote com `pip install playwright`, sem `playwright install`.
- Esta sessão não tem acesso a `developers.cloudflare.com` (rede). Pedir ao Arthur para liberar, ou confirmar à mão no painel.
