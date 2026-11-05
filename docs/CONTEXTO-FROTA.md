# CONTEXTO-FROTA — leia isto primeiro

Passagem de bastão entre sessões do Claude. Escrito em 05/11/2026, no fim da sessão que montou o protótipo em Python.
Se algo aqui contradisser o que o Arthur disser hoje, vale o que ele disser, e este arquivo deve ser corrigido.

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

## 6. DECISÃO EM ABERTO Nº 1: o caminho da nuvem (Python × Cloudflare Pages)

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
**Se for A:** parar de acrescentar funcionalidade grande ao protótipo Python (seria trabalho jogado fora) e usá-lo como **referência de regras** (colagem do Excel, status, cálculos do Início, mapeamento do Word) e de dados (um script exporta o SQLite para o Supabase).

## 7. Supabase (conta "Assessoria M1")

Projetos vistos em 05/11/2026 (somente leitura):
- `M1-Growth-CRM-dev-pc` (`fpxgtidrkcypzbsmchev`, sa-east-1): **banco antigo do CRM**, com dados reais: ~140 leads, 142 contatos, 3 organizações, 36 páginas de marketing publicadas (+30 rascunhos), 55 itens de venda e 132 parcelas, 3.571 linhas de auditoria. O Arthur diz que o CRM foi para outra VPS e outro Supabase.
- `Família Kuster` (`igbdikbrzpyxwrbxuzha`, us-east-1): banco do repositório `familia-kuster`. **Não mexer.** (Detalhe a olhar com ele: o painel marca esse projeto com canal de versão "withdrawn".)
- Plano gratuito: **2 projetos ativos**. Hoje são exatamente 2, então criar o da Frota exige pausar ou apagar um.

**Recomendação para a Frota (a confirmar):** **projeto novo**, nome `frota`, região **São Paulo (sa-east-1)**, em vez de limpar/renomear o `CRM-dev-pc`. Motivos: o antigo tem centenas de tabelas, usuários, políticas e segredos do CRM; **as chaves dele já foram coladas em chats** (o `CONTEXTO-M1.md` do CRM manda trocá-las), então não deve ser reaproveitado; renomear não resolve nada disso.
Ordem segura: (1) confirmar com o Arthur que o CRM novo **não usa mais** esse banco e que as 36 páginas de marketing etc. foram migradas; (2) **backup** do antigo (`supabase db dump`, como no `familia-kuster/.github/workflows/backup.yml`); (3) **pausar** o antigo (reversível, libera a vaga); (4) criar o `frota` (cadastro aberto desligado, RLS em toda tabela, chave `service_role` nunca no navegador nem no repositório); (5) **apagar** o antigo só semanas depois, quando ele tiver certeza. Nenhum desses passos foi executado.

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

## 9. Plano proposto (a ajustar com o Arthur)

0. **Decidir** o caminho da nuvem (seção 6) e as 5 perguntas (seção 5).
1. **Supabase novo** `frota` (seção 7), com ele acompanhando; chaves e senhas só entre ele e o painel.
2. **Esqueleto** do app novo a partir do `familia-kuster` (autenticação, design system, PWA, migrations, RLS, backup). Aproveitar o Azul Frota e as regras do `docs/design-system.md`.
3. **Esquema no Supabase** (veículos, clientes, eventos, saídas, comodatos, painéis) com RLS e teste de isolamento.
4. **Trazer o que já existe:** Início, Veículos, colagem do Excel, Word, anotações (usando o editor React do CRM em vez de reimplementar).
5. **Motor de tabelas** (copiar do CRM) com relação, rollup, fórmula e status com grupos; Veículos e Eventos nele.
6. **Contratos** ligados à Saída; D4Sign quando houver acesso (via função do Supabase, nunca com a chave no navegador).
7. Devoluções, Faturamentos, Sinistros, Multas; por fim o Dashboard financeiro.
8. **Deploy** no Cloudflare Pages (ou Workers com Static Assets) + domínio; script para migrar os dados do SQLite da VPS; desligar a VPS.

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
