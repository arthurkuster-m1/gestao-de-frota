# Bancos do Notion: Veículos e Calendário de Uso

Lido em 18/10/2026, só leitura. Os dois bancos ficam em Marketing › Processos - GM MKT.

## 1. Veículos ("🚀 Frota de Marketing - 2025")

Um registro por carro.

| Propriedade | Tipo | Opções |
|---|---|---|
| Carro | título | ex.: "ONIX 0207" (modelo + final da placa/VIN) |
| Status | status | ver lista abaixo |
| Tipo | rollup (vem do Evento em "Prox. Destino") | mesmas opções do Tipo de Evento (abaixo) |
| Prox. Destino | relação → Eventos - Marketing | |
| Usage | relação → Calendário de Uso | |
| Sinistros | relação → banco Sinistros | |
| Comments | texto | |
| Localização Atual | texto | |
| Modelo | texto | ex.: "TRACKER 133CV RS TURBO RG1" |
| Cor | texto | |
| MY (ano-modelo) | texto | |
| Renovação | texto | |
| Seguro | texto | |
| Blindado | seleção | Não, Sim |
| Pedido | texto | |
| Placa | texto | |
| VIN (chassi) | texto | |
| OPT DEV | caixa de seleção | |
| Faturado | caixa de seleção | |
| Pedido Recebido | data | |
| Liberado da Produção | data | |
| Faturamento | data | |
| Devolvido | data | |

### Status do veículo (18 etapas)

**A fazer**
- 01 - Pedido Recebido
- 02 - Aguardando Faturamento
- 03 - Em Transporte 0Km
- 04 - Disponível S/ Fat
- 05 - Retrofitar e Devolver
- 06 - Revisão e Emplacamento
- 07 - Blindagem
- 08 - Revisão

**Em andamento**
- 09 - Deptos
- 10 - Disponível
- 11 - Reservado
- 12 - Em Uso
- 13 - Em Retorno de Evento

**Concluído**
- 14 - Manutenção
- 15 - Clonado/Gravame
- 16 - Em Devolução
- 17 - Venda VIP
- 18 - Devolvido

## 2. Calendário de Uso ("Calendário de Uso - MKT GM")

Um registro por saída de carro(s) para um evento ou uso.

| Propriedade | Tipo | Opções |
|---|---|---|
| Saída | título | ex.: "Envio [12/06] \| Sarah Ferreira - Montana 3194 [15/06/26 → 15/12/26]" |
| Status | status | ver lista abaixo |
| Veículo | relação → Veículos | |
| Evento | relação → Eventos - Marketing | |
| Tipo | rollup (vem do Evento) | mesmas opções do Tipo de Evento (abaixo) |
| Carros | texto | |
| Comments | texto | |
| Envio | data | |
| Início do Evento | data | |
| Final do Evento | data | |
| Responsável | texto | |
| Localização | texto | |
| Solicitante | texto | |
| Depto | texto | |
| NF | texto | |
| PTA (Ida) | texto | |
| Valor \| PTA (Ida) | número (R$) | |
| PTA (Retorno) | texto | |
| Valor \| PTA (Retorno) | número (R$) | |
| Apoio TSO | texto | |
| Valor \| TSO | número (R$) | |
| Valor Total | fórmula | (soma dos valores) |
| Transportadora | seleção múltipla | Workcar, TSO, Retirada, Transzero |
| Seguro | texto | |
| Qtd Veículos | fórmula | |

### Status da saída (14 etapas)

**A fazer**
- Waiting
- Planejado
- PTA e TA pendente
- Ag Deptos
- Solicitar Envio

**Em andamento**
- Envio Solicitado
- Contrato Pendente
- Aguardando Assinaturas
- Em Uso
- Test Drive VIP
- Solicitar Retorno

**Concluído**
- Retorno Solicitado
- Aprovar NF
- Completo

## Banco de apoio: Eventos - Marketing

Os dois bancos puxam o "Tipo" daqui, então ele entra no projeto também.

| Propriedade | Tipo |
|---|---|
| Evento | título |
| Tipo | seleção |
| Saídas | relação → Calendário de Uso |
| Status, Início/Final do Comodato, Comment, Unidades em Uso | rollups do Calendário de Uso |

**Opções de Tipo:** Comodato > 1 Mês, Evento ou Gravação <1 Mês, Frota, Corrida, Agrifeira, Experience, Lançamentos, Deptos GM, Treinamento UC, Evento de Varejo.

## Pontos de atenção para o software novo

- No Status do veículo, "14 - Manutenção" e "15 - Clonado/Gravame" estão no grupo Concluído do Notion, mas na prática são estados em que o carro volta a circular. Vale revisar os grupos.
- Vários campos que deveriam ser ligação ou lista estão como texto livre: Responsável, Solicitante, Depto, Carros, Seguro, Localização. No software novo eles podem virar cadastros próprios.
- "Carros" (texto) repete o que a relação "Veículo" já diz.
- Também existe o banco "Sinistros", ligado aos veículos, que não li em detalhe.
