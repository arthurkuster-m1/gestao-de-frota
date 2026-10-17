from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Tudo que muda entre o modo local e a nuvem mora em variáveis FROTA_*.

    O modo local é o padrão: um arquivo SQLite e uma pasta de arquivos dentro de `dados/`.
    Para Postgres/Supabase basta trocar `FROTA_DATABASE_URL`.
    """

    model_config = SettingsConfigDict(env_prefix="FROTA_", env_file=".env", extra="ignore")

    data_dir: Path = Path("dados")
    database_url: str | None = None
    # Senha de acesso. Vazia = sem login (uso só no seu PC). Na VPS é obrigatória.
    senha: str = ""
    segredo: str = "troque-me"  # assina o cookie de sessão; o instalador gera um aleatório
    cookie_seguro: bool = False  # true atrás de HTTPS

    @property
    def db_url(self) -> str:
        if self.database_url:
            return self.database_url
        self.data_dir.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{(self.data_dir / 'frota.sqlite').resolve()}"

    @property
    def files_dir(self) -> Path:
        d = self.data_dir / "arquivos"
        d.mkdir(parents=True, exist_ok=True)
        return d


def get_settings() -> Settings:
    return Settings()
