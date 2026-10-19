# Mapa de funcionalidades da Frota

Base: `docs/notion-propriedades.md` (lido do Notion em 18/10/2026). O banco **Sinistros** do Notion ainda não foi lido em detalhe; as telas de Multas, Faturamentos e Devoluções não têm banco próprio no Notion e nascem de campos que já existem nos outros três.

## 1. Os três bancos do Notion viram quatro coisas

| Notion | No Frota | Papel |
|---|---|---|
| Frota de Marketing | **Veículo** | um registro por carro |
| Eventos - Marketing | **Evento** | o motivo do uso (tipo, nome); agrupa várias saídas |
| Calendário de Uso | **Saída** | cada ida de carro(s) para um evento: datas, transporte, valores, NF, situação em 14 etapas |
| (não existe) | **Contrato de Comodato** | o documento Word, gerado a partir de uma Saída |

A Saída é o registro central: liga Veículo e Evento, e é nela que se passa quase tudo (envio, contrato, assinatura, retorno, nota fiscal). Hoje o `Comodato` do sistema faz o papel de Saída e de contrato ao mesmo tempo. Ao construir Eventos, ele se separa nos dois.

## 2. A fundação: motor de tabelas estilo Notion

Veículos, Eventos, Saídas, Sinistros, Multas e Faturamentos pedem a mesma coisa: tabela editável com colunas que o usuário cria, filtros, ordenação, agrupamento e visualizações salvas. É o motor que existe no CRM (`lib/motor/*`, `lib/tarefas/propriedades.ts`) e será portado para Python.

O que o motor do CRM já tem: texto, número, seleção, seleção múltipla, data, caixa de seleção, URL; filtros por tipo; visualizações salvas (tabela, quadro, calendário, linha do tempo, galeria).

O que os bancos do Notion exigem e **o CRM não tem**:

| Tipo de coluna | Onde aparece |
|---|---|
| **Relação** (Veículo ↔ Saída ↔ Evento ↔ Sinistro) | todos os bancos |
| **Rollup** (traz um campo da relação) | `Tipo` vem do Evento; datas e status do Evento vêm das Saídas |
| **Fórmula** | `Valor Total` (soma dos valores), `Qtd Veículos` |
| **Status com grupos** (A fazer / Em andamento / Concluído) | Veículo (18 etapas) e Saída (14 etapas) |
| **Título** (nome do registro, obrigatório) | Carro, Saída, Evento |
| **Moeda (R$)** | valores de PTA, TSO, faturamento |

Por isso o motor é o **primeiro item do plano**: sem ele, cada tela vira uma tabela feita à mão.

## 3. Página por página

### Início
Já feita com dados reais: boas-vindas, próximos envios, próximos retornos, calendário da semana, alertas.
- **Tarefas pendentes** não precisa de um sistema de tarefas separado. Elas saem dos status da Saída: *Solicitar Envio*, *PTA e TA pendente*, *Contrato Pendente*, *Aguardando Assinaturas*, *Solicitar Retorno*, *Aprovar NF*. Cada status "a fazer" vira uma tarefa para você.
- **Alertas** ganham: licenciamento e seguro vencendo, multa com prazo de indicação, veículo parado em um status por muito tempo.

### Veículos
Tabela completa estilo Notion. Colunas do Notion:

| Grupo | Propriedades |
|---|---|
| Identificação | Carro (título, ex.: "ONIX 0207"), Placa, VIN (chassi), Modelo, Cor, MY (ano-modelo), Blindado (Sim/Não), Pedido |
| Situação | Status (18 etapas), Localização Atual, Comments |
| Ligações | Prox. Destino → Evento, Usage → Saídas, Sinistros → Sinistros |
| Datas | Pedido Recebido, Liberado da Produção, Faturamento, Devolvido |
| Marcações | OPT DEV, Faturado |
| Soltas no Notion | Renovação, Seguro (texto livre) |

Visões: tabela, quadro por status, calendário, galeria. Importação do Notion por CSV.

### Eventos
Tabela com visualização em **linha do tempo**. Propriedades: Evento (título), Tipo (Comodato > 1 Mês, Evento ou Gravação < 1 Mês, Frota, Corrida, Agrifeira, Experience, Lançamentos, Deptos GM, Treinamento UC, Evento de Varejo), Saídas (relação), e rollups: Status, Início/Final do Comodato, Comment, Unidades em Uso.
A linha do tempo do evento é calculada das datas das Saídas.

### Contratos de Comodato
Já existe: lista, criar em lote (colar do Excel), modelos Word, geração do `.docx`.
Falta ligar à Saída (contrato nasce dela e atualiza o status: *Contrato Pendente* → *Aguardando Assinaturas*), acompanhar assinatura e, no futuro, enviar pela D4Sign.

### Sinistros e Manutenções
Sinistros: relação com Veículo (e, pela data, com a Saída vigente). **Falta ler o banco do Notion.** Manutenções: o Notion usa só o status *14 - Manutenção*; no Frota ganham registro próprio com data, custo e oficina.

### Multas
Placa + data/hora da infração, cruzadas com a Saída vigente, trazem o responsável e o contato. Prazo de indicação do condutor. Importação por planilha.

### Faturamentos
Saída: NF (texto), PTA Ida/Retorno e Apoio TSO com valor, Valor Total, Transportadora, status *Aprovar NF*. Veículo: marcação Faturado e data de Faturamento.

### Devoluções
Veículo: status *16 - Em Devolução* e *18 - Devolvido*, data Devolvido, OPT DEV. Saída: *Solicitar Retorno*, *Retorno Solicitado*. Checklist de devolução e fotos são novos.

### Dashboard financeiro
Custos completos: transporte (PTA ida, retorno, TSO), sinistros, manutenções, multas, seguro. Por veículo, evento, transportadora e mês.

## 4. Dados que viram cadastro

No Notion estes campos são texto livre e atrapalham filtro e relatório. No Frota viram cadastro próprio (com opção de digitar na hora):

| Campo | Vira |
|---|---|
| Responsável, Solicitante | Pessoa (com contato) |
| Depto | Departamento |
| Transportadora (já é seleção múltipla) | Transportadora |
| Seguro | Apólice (seguradora, número, vigência) |
| Localização, Localização Atual | Local |
| Carros (texto) | **some**: repete a relação Veículo |

## 5. Pontos de atenção levantados no arquivo

1. No status do veículo, *14 - Manutenção* e *15 - Clonado/Gravame* estão em "Concluído" no Notion, mas são estados em que o carro volta a circular. Os grupos serão revistos.
2. Os 18 status do veículo misturam duas coisas: o caminho do carro 0 km até estar pronto (01–08) e o uso na operação (09–13). Vale decidir se continuam numa coluna só.
3. `Valor Total` e `Qtd Veículos` são fórmulas; no Frota são calculados e nunca digitados.
4. O título da Saída no Notion ("Envio [12/06] | Sarah Ferreira - Montana 3194 [15/06/26 → 15/12/26]") é montado à mão. No Frota é gerado.

## 6. Ordem sugerida

1. **Motor de tabelas** com relação, rollup, fórmula, status com grupos e visualizações.
2. **Veículos** no motor, com importação do CSV do Notion.
3. **Eventos e Saídas**, com a linha do tempo.
4. **Contratos** ligados à Saída.
5. **Início** com as tarefas derivadas dos status.
6. **Devoluções**, **Faturamentos**, **Sinistros e Manutenções**, **Multas**.
7. **Dashboard financeiro** por último, porque depende dos custos de todos os outros.

## 7. Decisões em aberto

1. Uma Saída é de **um veículo** ou de **vários**? No Notion a relação aceita vários e há `Qtd Veículos`. Recomendação: uma linha por veículo, agrupadas pelo Evento, porque PTA, NF e contrato são por carro.
2. O contrato de comodato é **por Saída** (um por carro) ou **por Evento** (um para todos os carros)?
3. Manter os 18 status do veículo como estão, ou separar "caminho do 0 km" de "uso na operação"?
4. Ler o banco **Sinistros** do Notion para definir as propriedades.
5. Existe fonte para **Multas**, **Faturamentos** e **Devoluções** (planilhas, outro Notion), ou nascem do zero?
