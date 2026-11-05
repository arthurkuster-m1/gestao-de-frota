"""Ambiente do Alembic. Quem chama é `frota.db.init_db`, que já passa a conexão pronta."""

from alembic import context

from frota import models  # noqa: F401  (registra as tabelas)
from frota.db import Base

conexao = context.config.attributes["connection"]
# render_as_batch: o SQLite não altera coluna no lugar; o Alembic recria a tabela por baixo.
context.configure(connection=conexao, target_metadata=Base.metadata, render_as_batch=True,
                  compare_type=True)
with context.begin_transaction():
    context.run_migrations()
