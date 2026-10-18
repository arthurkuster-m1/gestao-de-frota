from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text

from frota import db as dbmod
from frota.db import Base


def _diferencas(engine):
    with engine.connect() as conn:
        return compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata)


def test_banco_novo_fica_igual_aos_models(tmp_path):
    eng = dbmod.init_db(f"sqlite:///{tmp_path / 'novo.sqlite'}")
    assert _diferencas(eng) == [], "models.py mudou sem migration: rode frota-migracao"
    with eng.connect() as conn:
        assert conn.scalar(text("select version_num from alembic_version")) is not None


def test_banco_de_antes_do_alembic_recebe_carimbo_e_mantem_dados(tmp_path):
    url = f"sqlite:///{tmp_path / 'antigo.sqlite'}"
    antigo = dbmod.make_engine(url)
    Base.metadata.create_all(antigo)  # como o init_db fazia até aqui
    with antigo.begin() as conn:
        conn.execute(text("insert into veiculos (id, placa, status, dados, criado_em) "
                          "values ('v1', 'ABC1D23', 'disponivel', '{}', '2026-01-01')"))
    antigo.dispose()

    eng = dbmod.init_db(url)
    assert "alembic_version" in inspect(eng).get_table_names()
    with eng.connect() as conn:
        assert conn.scalar(text("select placa from veiculos")) == "ABC1D23"
    assert _diferencas(eng) == []
