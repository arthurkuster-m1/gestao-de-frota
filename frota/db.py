from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str | None = None):
    url = url or get_settings().db_url
    engine = create_engine(url, future=True)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn, _):
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA journal_mode=WAL")
            cur.close()

    return engine


engine = None
SessionLocal = sessionmaker(autoflush=False, expire_on_commit=False)


MIGRACOES = Path(__file__).parent / "migracoes"
# Revisão que corresponde às tabelas que o `create_all` criava antes do Alembic.
REVISAO_INICIAL = "0001"


def alembic_config() -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRACOES))
    return cfg


def init_db(url: str | None = None):
    """Leva o banco até a última migration (cria tudo se estiver vazio)."""
    global engine
    engine = make_engine(url)
    SessionLocal.configure(bind=engine)
    cfg = alembic_config()
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        tabelas = set(inspect(conn).get_table_names())
        if "veiculos" in tabelas and "alembic_version" not in tabelas:
            # Banco criado antes do Alembic (ex.: o da VPS): as tabelas já são as da 0001.
            command.stamp(cfg, REVISAO_INICIAL)
        command.upgrade(cfg, "head")
    return engine


def nova_migracao() -> None:
    """`frota-migracao "o que mudou"`: gera a migration comparando models.py com o banco local."""
    import sys

    msg = " ".join(sys.argv[1:]) or "mudanca"
    eng = make_engine()
    cfg = alembic_config()
    with eng.begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")
        numeros = [int(f.name[:4]) for f in (MIGRACOES / "versions").glob("[0-9][0-9][0-9][0-9]_*.py")]
        command.revision(cfg, message=msg, autogenerate=True, rev_id=f"{max(numeros, default=0) + 1:04d}")


def get_session():
    with SessionLocal() as s:
        yield s
