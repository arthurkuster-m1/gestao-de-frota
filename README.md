# Frota

Gestão de frota 100% local: veículos, clientes, comodatos (com Word gerado a partir de modelos),
e, nas próximas fases, multas, sinistros, seguros e inventário.

## Rodar

```bash
pip install -e ".[dev]"
frota            # http://127.0.0.1:8000  (dados em ./dados/frota.sqlite)
pytest
```

Tudo fica na pasta `dados/` (banco SQLite + modelos Word). Para backup ou outro PC, copie a pasta.
Postgres/Supabase no futuro: `FROTA_DATABASE_URL=postgresql+psycopg://...` (`pip install -e ".[postgres]"`).

## Banco e migrations

O esquema evolui por migrations do Alembic em `frota/migracoes/versions/`, aplicadas sozinhas quando o
Frota sobe. Um banco antigo, de antes do Alembic, é reconhecido e recebe só o carimbo da `0001`.

Para mudar uma tabela: altere `frota/models.py` e rode `frota-migracao "o que mudou"`. Isso gera o
próximo arquivo numerado (`0002_...`). Revise e commite junto com a mudança do models. O teste
`tests/test_migracoes.py` reprova se o `models.py` mudar sem migration.

## Visual

Mesmo design do CRM M1 Growth, com destaque em azul (`#3366A0`). Guia em
[`docs/design-system.md`](docs/design-system.md); a tela **Design system** (`/design`) mostra cada peça.

## Comodato em Word

1. **Modelos Word**: suba um `.docx` com campos `{{ cliente_nome }}`, `{{ veiculo_placa }}`, `{{ data_saida }}` etc.
   A página lista os campos que o sistema conhece. Campo desconhecido gera erro claro, nunca um contrato com buraco.
2. **Comodatos em lote**: cole a tabela do Excel (com cabeçalho). O sistema confere placas e disponibilidade,
   mostra o que está ok/com erro e, ao confirmar, cria os comodatos e libera o ZIP com os Word preenchidos.
   Colunas extras viram campos do modelo (coluna "Centro de custo" → `{{ centro_de_custo }}`).

## Na VPS

Veja `deploy/LEIA-ME.md`. Senha única (`FROTA_SENHA`), serviço isolado em `127.0.0.1:8001`, atualização automática por git e backup diário.

## Próximos passos

Assinatura D4Sign (`Comodato.assinatura` já reservado) · formulário público (Cloudflare Pages → webhook) ·
multas · sinistros · seguros · inventário · motor de tabelas estilo Notion.
