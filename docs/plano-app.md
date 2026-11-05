# Plano do app Frota (versão React + Supabase)

Escrito em 05/11/2026 a partir das especificações do Arthur. Substitui a ordem sugerida em `mapa-funcionalidades.md` (que partia do protótipo Python). Onde este plano e o `CONTEXTO-FROTA.md` divergirem, vale este, e o CONTEXTO deve ser corrigido.

## 1. O que o Arthur já respondeu (e fecha as 5 perguntas do Notion)

| Pergunta antiga | Resposta tirada da especificação |
|---|---|
| 1. Saída: um carro ou vários? | **Uma linha por carro** (`evento_veiculos`). O **transporte** é que agrupa carros (1 PTA com vários carros). |
| 2. Contrato: por carro ou por evento? | **Por evento** (e cliente), confirmado pelo Arthur em 05/11/2026. Aditivo para **troca de carros** e para **extensão de prazo**. |
| 3. 18 status numa coluna só? | **Não. Dois status:** *Ciclo de Vida* e *Status de Uso*. |
| 4. Banco Sinistros do Notion | **Adiada.** Sinistro virou um tipo dentro de Manutenções (versão simples). |
| 5. Fonte de Multas, Faturamentos, Devoluções | **Parcial.** Faturamento vira *Pagamentos* (PTA e NF da TSO). Devolução é etapa do Ciclo de Vida. Multas: versão simples definida (AIT, veículo, data e hora, valor, status, endereço, comentários, evento automático). |

## 2. Conceitos

- **Ciclo de Vida:** nascimento e venda do carro. Etapas: Pedido Recebido, Liberado, Em Transporte 0 km, Disponível sem Faturamento, Revisão e Emplacamento, Em Blindagem, Disponível (Emplacado e Pronto), Gravame, Venda VIP, Em Devolução, Devolvido. Meta: inventário em torno de 200 carros.
- **Status de Uso:** o que o carro está fazendo agora na operação: Disponível, Reservado, Em Uso, Em Retorno, Manutenção. Vale para carro que já pode circular (inclusive "Disponível sem Faturamento", que pode ir a evento).
- **Evento:** o motivo do uso. Nome único.
- **Reserva (`evento_veiculos`):** um carro num evento, com seus locais, datas, transportes e checklists. É o registro central. Um carro pode ter várias reservas, inclusive encavaladas.
- **Transporte:** uma ida ou uma volta (PTA da Workcar, orçamento da TSO ou retirada). Agrupa vários carros.
- **Pagamento:** a cobrança que precisa ser aprovada e paga (PTA ou NF da TSO). Um pagamento pode cobrir vários transportes (TSO combina ida e volta em um orçamento só).

## 3. Regra de ouro: o que é guardado e o que é calculado

Para o status e o comentário dos carros nunca ficarem desatualizados, **eles não são digitados nem copiados**:

- **Status de Uso** do veículo = calculado a partir das reservas e das manutenções: manutenção grave aberta → *Manutenção*; reserva *em uso* → *Em Uso*; *em retorno* → *Em Retorno*; reserva futura → *Reservado*; senão *Disponível*. Quem muda é a reserva (o checklist de saída muda para *em uso*; o de retorno fecha). Manutenção "não grave" não bloqueia (o carro continua indo a eventos).
- **Agenda em texto** ("EM USO - EVENTO TESOURARIA 04/11 ATÉ 05/11 + RESERVADO - EVENTO X 07/11 ATÉ 12/11") = calculada das reservas. A aba **Comentários** é só texto livre do Arthur.
- **Código** = modelo + 4 últimos dígitos do VIN (coluna gerada).
- **Valor Total** do evento = soma dos transportes. **Valor real** vem do pagamento.
- **Venda VIP liberada** = faturamento há mais de 1 ano.
- **Divergência de contrato** = comparação entre os carros e as datas da reserva e os carros e a vigência do contrato.

Trigger de banco **nunca** faz chamada de rede; só grava histórico e avisos.

## 3-A. Prazo de logística (regra do Arthur, 05/11/2026)

**Dias de viagem = distância em km ÷ 500, arredondado para cima** (3.000 km = 6 dias; 600 km = 2 dias, suposição de arredondamento a confirmar). Depende do trajeto e do transporte:
- Cada **transporte** tem a sua distância (`distancia_km`, digitada; o app calcula os dias e deixa ajustar à mão). A reserva do carro começa `dias_ida` antes da chegada e termina `dias_volta` depois da retirada.
- **Retirada** pelos próprios funcionários ou clientes: 0 dia de logística (a conferir).
- Cálculo automático da distância por endereço (CEP/cidade) fica para depois; exigiria um serviço de mapas.

## 4. Tabelas (todas com `workspace_id`, RLS "sou membro do espaço" e teste de isolamento)

**Veículos e histórico**
- `veiculos`: placa, vin, modelo, cor, my, pedido, blindado, seguro_status, status_ciclo, datas-chave (pedido recebido, liberação, faturamento, emplacamento, devolução), comentarios, campos personalizados. `codigo` é gerado.
- `veiculo_atividades`: histórico append-only (tipo, data, descrição, ponteiro para o que causou). Alimentado por trigger ao mudar status, reserva, manutenção, checklist.

**Pessoas e lugares**
- `clientes`: pessoa física ou jurídica, nome/razão social, CPF/CNPJ, e-mail, endereço (rua, número, complemento, cidade, estado, CEP), testemunha e e-mail da testemunha.
- `cliente_motoristas`: nome, CPF, CNH (registro e validade). Quantidade = contagem das linhas.
- `locais`: nome, endereço, contato (nome e telefone). Usado como Local de Saída e Local do Evento, e reaproveitado.

**Eventos**
- `eventos`: nome (único por espaço), tipo, cliente, solicitante, status (Planejado, Solicitar Transporte, Envio Solicitado, Em Uso, Solicitar Retorno, Retorno Solicitado, Concluído), 
- `evento_veiculos` (reserva): evento, veículo, local de saída, local do evento, chegada e retirada (data e hora), início e fim da reserva (já com a logística), estado (reservado, em uso, em retorno, concluído, trocado/cancelado), transporte de ida, transporte de volta. O formulário permite "para todos" e "por carro" e grava sempre **por carro**.
- `transportes`: evento, sentido (ida/volta), modalidade (PTA, TSO, retirada), distância em km e dias de viagem (calculado, ajustável), referência (ex.: PTAS00666314), transportadora, valor planejado, situação, pagamento.
- `pagamentos`: tipo (PTA, NF TSO), número, valor planejado, valor real, data de pagamento, departamento responsável, situação (pendente, aprovado, pago).
- `checklists`: reserva, momento (saída/retorno), data/hora, km, combustível ou carga, limpeza, entregue para, anotações, fotos (Storage privado).

**Contratos**
- `contratos_comodato`: evento, cliente, status (rascunho, enviado, aguardando assinaturas, assinado, encerrado), vigência, arquivo, id do D4Sign (futuro).
- `contrato_veiculos`: os carros que o contrato cobre.
- `contrato_aditivos`: tipo (troca de carros, extensão de prazo), motivo, carros antes/depois, vigência antes/depois, status (rascunho, enviado, aguardando assinaturas, assinado). A vigência em vigor é a do último aditivo assinado.

**Manutenção, multas, visões**
- `manutencoes` (**inclui os sinistros**, decisão do Arthur em 05/11/2026): nome, veículo, **tipo** (Sinistro/funilaria, Mecânica, Revisão, Outro; lista editável), data da ocorrência, data em que a DA foi solicitada (só sinistro), descrição (do acidente, no caso de sinistro), comentários, status (**Solicitar DA, Em reparo, Pronto**; "Solicitar DA" só aparece para sinistro, a adaptar), oficina e custo (depois), `bloqueia_uso` (**o Arthur decide por registro** se o carro ainda pode ir a evento), e **evento responsável** (`evento_veiculo_id`): preenchido sozinho com a reserva que o carro tinha na data da ocorrência; refinamento mais adiante. O banco completo de Sinistros do Notion fica para depois e entra por migration nova.
- `multas` (versão simples): nome, **AIT** (código da multa), veículo, data e hora da infração, valor, status, comentários, endereço do local, e **evento** (`evento_veiculo_id`), preenchido sozinho com a reserva que o carro tinha naquele dia e hora; dali se chega ao cliente e aos contatos. Se nenhuma reserva cobre o horário, fica em branco e avisa. Status (a confirmar com o Arthur): **1. Notificação recebida → 2. Pagamento realizado (cobrar do cliente) → 3. Solicitar boleto → 4. Pago pelo cliente (finalizada)**. A empresa paga primeiro e depois cobra do cliente.
- `visoes_salvas` e `propriedades_personalizadas`: como no CRM, por tela (tabela, cards, linha do tempo, filtros, ordem, colunas visíveis, colunas congeladas).

## 5. Telas

Menu: **Início, Planejamento, Veículos, Eventos, Clientes, Contratos, Transportes e Pagamentos, Manutenções (com sinistros), Multas, Devoluções, Dashboard financeiro, Configurações.** (Mudou em relação ao protótipo: entram *Planejamento* e *Clientes*; *Faturamentos* vira *Transportes e Pagamentos*.)

- **Veículos:** visão Tabela, Cards e Linha do tempo, com visões salvas, escolha de propriedades e colunas congeladas (motor do CRM). Ficha do veículo em janela: dados, Atividade, Manutenções, Eventos, Multas, Agenda (visual e em texto) e Comentários. Cadastro por formulário individual e em massa, no estilo de `Lancar.tsx` e `Massa.tsx` de Finanças.
- **Eventos:** mesmo motor. Formulário e tabela em massa. O cliente já cadastrado preenche sozinho CNPJ, endereço e e-mails; no evento só se preenche o que varia.
- **Planejamento:** tela dividida, como o desenho. Em cima, tabela de Veículos com filtros e visões; embaixo, tabela de Eventos; à direita, **uma linha do tempo única, sem fim, que serve às duas** (calendário infinito). O carro mostra as reservas (barra cinza) e manutenções (amarelo); o evento mostra a data do evento (cinza) com os prazos de logística antes e depois (azul). Dali se cria evento e manutenção, e se escolhem os carros do evento selecionado.
- **Contratos:** status, Word por modelo, conferência com os carros e o prazo do evento, e criação de aditivo (troca de carros ou extensão de prazo).
- **Devoluções (planejamento, detalhado mais adiante pelo Arthur):** tela para decidir quais carros saem da frota. O app **pré-filtra sugestões**, todas calculadas: carros mais velhos (tempo desde o faturamento), muito tempo parados, muito tempo disponíveis sem uso real (dias desde a última saída). Gravame e carros em reserva futura aparecem com aviso. Em cada carro o Arthur marca **Devolver** ou **Manter**, com data prevista. Também planeja **trocas**: "este carro vai para tal cliente e o carro que estava lá vai para devolução", o que vira, ao executar, um aditivo de troca de carros no contrato. Mostra o inventário contra a meta de 200. Guardado em `veiculos.decisao_devolucao` + data prevista e em `trocas_planejadas` (carro que sai, carro que entra, contrato, data, situação).
- **Início, Multas, Dashboard:** seguem o mapa de funcionalidades, depois das telas acima.

## 6. O que vem do CRM e do `familia-kuster`

- **CRM (`main`):** `lib/motor` e `components/motor` (tabela, visões, filtros, ordem de colunas; o motor já tem `visualizacao: tabela | kanban | calendario | timeline | galeria`); `EditorDeBlocos.tsx` para anotações. **A linha do tempo do CRM é de campanhas;** a do Planejamento (barras por carro e por evento, com zoom infinito e duas tabelas ligadas) será escrita sobre o layout do motor e é a maior peça nova.
- **`familia-kuster`:** `src/ds`, `Shell`/`Sidebar`, login, `supabase.ts`, backup, `Lancar.tsx` e `Massa.tsx`, teste de RLS, `SETUP.md`.
- **O motor do CRM não tem** relação, rollup, fórmula, status com grupos nem moeda. Aqui isso vem do **banco** (junções e colunas calculadas), e o motor só exibe.

## 7. Ordem de construção

0. ✅ Caminho A decidido; núcleo do banco aplicado (conferido em 05/11/2026).
1. **Esqueleto do app** (`web/`): design system Azul Frota e Montserrat, menu, login, conexão com o Supabase. **Publicar cedo no Cloudflare Pages** para o Arthur ver pelo celular a cada PR na `main`.
2. **Tabelas de Veículos, Clientes, Locais** + atividade, com teste de RLS.
3. **Veículos:** formulário, massa, visões salvas.
4. **Eventos e reservas:** formulário, massa, cliente reaproveitado, agenda e status do veículo calculados.
5. **Planejamento** (timeline).
6. **Transportes, Pagamentos e Checklists** (a automação do status).
7. **Contratos:** Word, conferência, aditivo. D4Sign depois, quando houver acesso.
8. **Manutenções (com sinistros), Multas, Devoluções**, Início, Dashboard financeiro.
9. **Backup automático**, segunda pessoa na conta, importação do que valer a pena, desligar a VPS antiga.

## 7-A. Estado em 06/11/2026 (o que mudou na ordem)

O Arthur apontou (com razão) que a tela de Veículos entregue primeiro era só uma lista simples. O **motor de visualizações** passou a ser feito junto de Veículos, em 3 entregas:

1. ✅ **Tabela estilo CRM** em Veículos: filtros por tipo de campo com E/OU, ordenação (painel e clique no título), agrupamento, propriedades (mostrar/esconder, arrastar, congelar colunas), largura de coluna arrastável, e **visualizações salvas** (criar, salvar alterações, descartar, renomear, duplicar, excluir; migration 0004). A lógica de consulta/colunas foi portada do CRM (`web/src/lib/motor`, cobertura de testes própria); a parte visual foi reescrita no design system da Frota, porque a do CRM é Tailwind.
2. ✅ **Cards** (mesma consulta, mesmas propriedades e mesma edição no lugar da tabela; alternar Tabela/Cards e visualização salva do tipo Cards) e **janela do veículo** (`/veiculos/:id`, abas Dados, Atividade, Comentários; Agenda, Eventos, Manutenções e Multas explicam o que vão mostrar e entram junto das telas que as alimentam).
3. ⬜ **Linha do tempo** (base da tela de Planejamento).

**Regra do Arthur (06/11/2026): toda visão é editável no lugar — tabela, cards e linha do tempo.** O editor é um só (`web/src/components/motor/EditorDeCelula.tsx` + `edicao.ts`, com a regra de normalizar/validar/gravar) e cada visão o reaproveita. ✅ Tabela: clicar na célula edita (texto, opção, data, caixa), Enter grava, Esc cancela, Tab grava e vai para a próxima célula, erro do banco aparece em português; o código e o ícone abrem a ficha. ✅ Cards e ✅ janela do veículo usam o mesmo editor (`useEdicao`, `CampoEditavel`). ⬜ Linha do tempo: entrega 3, com o mesmo editor.

Ainda sem tela: seleção de linhas e edição em massa, Status de Uso e agenda em texto (dependem de Eventos e Manutenções).

## 7-B. Estado em 07/11/2026: eventos, reservas e uso do carro

- ✅ **Eventos e reservas (v1):** tabelas `eventos` e `evento_veiculos` (migration 0006). Tela **Eventos** no mesmo motor de Veículos (abas salvas, filtros, Tabela/Cards, edição no lugar), janela do evento com os carros reservados (início, fim e estado editáveis no lugar; **aviso de conflito** quando o carro já está em outra reserva) e seletor "Reservar carros".
- ✅ **Status de uso e Agenda em texto** em Veículos: calculados das reservas abertas (em retorno > em uso > reservado > disponível; "Manutenção" entra com a tela de Manutenções). Agenda no formato "EM USO - EVENTO X 04/11 ATÉ 05/11 + RESERVADO - EVENTO Y 07/11 ATÉ 12/11", acumulando todas as reservas abertas. Aparecem também nos Cards e na janela do veículo (abas Agenda e Eventos).
- ✅ **Ciclo de vida automático** (migration 0005): data e status andam juntos (só para a frente); escolher um status de marco preenche a data com hoje; a tela avisa o que mudou sozinho. Premissas a confirmar: carro blindado vai a "Em blindagem" ao emplacar; faturar com o carro ainda em transporte não muda o status.
- ✅ Opções de status em formato de **tags**; a etapa "Disponível (emplacado e pronto)" passou a se chamar **"Pronto"**.
- Ainda não: local de saída/evento por carro, transportes, pagamentos, checklists e contrato do evento; horários (as reservas hoje são por data); o botão "Em uso" automático pelo checklist; carro em Manutenção no Status de uso.
- Refatoração: a casca das telas de lista virou `TelaDoMotor` (abas, filtros, Tabela/Cards, busca, edição no lugar); telas novas só trazem campos e dados.

## 8. Perguntas abertas (uma de cada vez)

1. ~~Contrato por evento ou por carro?~~ Respondida: por evento, com aditivos.
2. ~~Prazo de logística~~ Respondida: ver seção 3-A.
3. ~~Sinistros~~ Adiada: são um tipo de Manutenção (seção 4); o banco completo do Notion fica para depois.
4. **Multas:** campos mínimos definidos (ver seção 4). Status definidos (seção 4), falta o Arthur confirmar a ordem.
5. ~~Devoluções~~ Planejamento definido (seção 5); checklist e documento da devolução ficam para depois.
6. ~~Seguro~~ Respondida: status simples (Pendente, Cadastrado, Cancelado); apólice e vigência ficam para depois.

## 9. O que NÃO foi testado

Tudo neste documento é projeto. Nenhuma tabela do domínio foi criada, nada foi rodado.
