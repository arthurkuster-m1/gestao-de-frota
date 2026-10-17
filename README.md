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
