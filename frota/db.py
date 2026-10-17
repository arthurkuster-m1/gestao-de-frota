from sqlalchemy import create_engine, event
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


def init_db(url: str | None = None):
    """Cria as tabelas. O Alembic assume quando o esquema precisar evoluir."""
    global engine
    from . import models  # noqa: F401  (registra as tabelas)

    engine = make_engine(url)
    SessionLocal.configure(bind=engine)
    Base.metadata.create_all(engine)
    return engine


def get_session():
    with SessionLocal() as s:
        yield s
