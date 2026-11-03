"""Anotações (editor de blocos) e informações contábeis da tela Início.

O servidor valida a forma de tudo que grava: o editor do navegador é conveniência, não garantia.
"""

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import Painel

TIPOS_DE_BLOCO = ("texto", "titulo1", "titulo2", "titulo3", "lista", "numerada", "tarefa",
                  "destaque", "citacao", "tabela", "separador")
MAX_BLOCOS = 500


class Bloco(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    tipo: Literal["texto", "titulo1", "titulo2", "titulo3", "lista", "numerada", "tarefa",
                  "destaque", "citacao", "tabela", "separador"]
    texto: str = Field(default="", max_length=5000)
    feito: bool = False
    celulas: list[list[str]] | None = None  # só o bloco "tabela"

    @field_validator("celulas")
    @classmethod
    def _celulas(cls, v):
        if v is None:
            return v
        if len(v) > 40 or any(len(l) > 10 for l in v) or any(len(c) > 300 for l in v for c in l):
            raise ValueError("tabela grande demais")
        return v


class Anotacoes(BaseModel):
    versao: int = Field(ge=0)
    blocos: list[Bloco] = Field(max_length=MAX_BLOCOS)


class ItemInfo(BaseModel):
    rotulo: str = Field(default="", max_length=80)
    valor: str = Field(default="", max_length=600)


class Infos(BaseModel):
    versao: int = Field(ge=0)
    itens: list[ItemInfo] = Field(max_length=60)


class Conflito(Exception):
    """Outro aparelho gravou antes: a versão que o navegador viu ficou velha."""


def ler(db: Session, chave: str, padrao: dict) -> tuple[dict, int]:
    p = db.get(Painel, chave)
    return (p.conteudo, p.versao) if p else (padrao, 0)


def gravar(db: Session, chave: str, conteudo: dict, versao_base: int) -> int:
    """Compara e troca: só grava se a versão ainda é a que quem salvou viu."""
    agora = datetime.now(timezone.utc)
    if db.get(Painel, chave) is None:
        if versao_base != 0:
            raise Conflito()
        try:
            with db.begin_nested():
                db.add(Painel(chave=chave, conteudo=conteudo, versao=1, atualizado_em=agora))
        except IntegrityError as e:  # outra gravação criou a linha entre a leitura e a escrita
            raise Conflito() from e
        db.commit()
        return 1
    r = db.execute(update(Painel).where(Painel.chave == chave, Painel.versao == versao_base)
                   .values(conteudo=conteudo, versao=versao_base + 1, atualizado_em=agora))
    if r.rowcount == 0:
        db.rollback()
        raise Conflito()
    db.commit()
    return versao_base + 1
