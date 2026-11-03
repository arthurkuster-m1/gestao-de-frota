"""Anotações (editor de blocos, os mesmos tipos do CRM) e informações contábeis da tela Início.

O servidor valida a forma de tudo que grava: o editor do navegador é conveniência, não garantia.
"""

import re
from datetime import datetime, timezone
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import Painel

MAX_BLOCOS = 300
_ID = Field(min_length=1, max_length=40)
_URL = re.compile(r"^https?://[^\s]+$", re.I)


# ---------- blocos (vocabulário do CRM: lib/marketing/blocos.ts) ----------
class _Item(BaseModel):
    texto: str = Field(default="", max_length=300)
    feito: bool = False


class _Cartao(BaseModel):
    titulo: str = Field(default="", max_length=120)
    texto: str = Field(default="", max_length=1200)


class _Numero(BaseModel):
    rotulo: str = Field(default="", max_length=120)
    valor: str = Field(default="", max_length=40)
    detalhe: str = Field(default="", max_length=200)


class _Lado(BaseModel):
    titulo: str = Field(default="", max_length=120)
    texto: str = Field(default="", max_length=1500)


class _Link(BaseModel):
    rotulo: str = Field(default="", max_length=120)
    url: str = Field(default="", max_length=500)

    @field_validator("url")
    @classmethod
    def _http(cls, v):
        """Link digitado sem https:// é completado; esquema que não é http(s) é descartado.
        Nunca recusa: uma URL ruim não pode derrubar a gravação de todas as anotações."""
        v = v.strip()
        if re.match(r"^[a-z][a-z0-9+.\-]*:(?!\d)", v, re.I) and not re.match(r"^https?://", v, re.I):
            return ""  # javascript:, mailto:, data:… (já "host:porta" passa, é endereço)
        if v and "://" not in v:
            v = "https://" + v
        return v if _URL.match(v) else ""


class _Passo(BaseModel):
    titulo: str = Field(default="", max_length=120)
    texto: str = Field(default="", max_length=200)


class Titulo(BaseModel):
    id: str = _ID
    tipo: Literal["titulo"]
    nivel: Literal[1, 2, 3] = 1
    texto: str = Field(default="", max_length=200)


class Texto(BaseModel):
    id: str = _ID
    tipo: Literal["texto"]
    texto: str = Field(default="", max_length=5000)


class Destaque(BaseModel):
    id: str = _ID
    tipo: Literal["destaque"]
    tom: Literal["info", "sucesso", "atencao"] = "info"
    texto: str = Field(default="", max_length=5000)


class Lista(BaseModel):
    id: str = _ID
    tipo: Literal["lista"]
    estilo: Literal["marcadores", "numerada", "check"] = "marcadores"
    itens: list[_Item] = Field(default_factory=list, max_length=60)


class Cartoes(BaseModel):
    id: str = _ID
    tipo: Literal["cards"]
    itens: list[_Cartao] = Field(default_factory=list, max_length=12)


class Metricas(BaseModel):
    id: str = _ID
    tipo: Literal["metricas"]
    itens: list[_Numero] = Field(default_factory=list, max_length=8)


class AntesDepois(BaseModel):
    id: str = _ID
    tipo: Literal["antes-depois"]
    antes: _Lado = Field(default_factory=_Lado)
    depois: _Lado = Field(default_factory=_Lado)


class Links(BaseModel):
    id: str = _ID
    tipo: Literal["links"]
    itens: list[_Link] = Field(default_factory=list, max_length=30)


class Citacao(BaseModel):
    id: str = _ID
    tipo: Literal["citacao"]
    texto: str = Field(default="", max_length=1000)
    autor: str = Field(default="", max_length=120)


class Fluxo(BaseModel):
    id: str = _ID
    tipo: Literal["fluxo"]
    itens: list[_Passo] = Field(default_factory=list, max_length=24)


class Matriz(BaseModel):
    id: str = _ID
    tipo: Literal["matriz"]
    estilo: Literal["swot", "neutro"] = "swot"
    celulas: list[_Lado] = Field(default_factory=lambda: [_Lado() for _ in range(4)], max_length=4)


class Tabela(BaseModel):
    id: str = _ID
    tipo: Literal["tabela"]
    colunas: list[Annotated[str, Field(max_length=60)]] = Field(default_factory=lambda: ["", ""], min_length=1, max_length=8)
    linhas: list[list[Annotated[str, Field(max_length=300)]]] = Field(default_factory=list, max_length=40)

    @model_validator(mode="after")
    def _largura(self):
        if any(len(l) > 8 for l in self.linhas):
            raise ValueError("linha com colunas demais")
        return self


class Separador(BaseModel):
    id: str = _ID
    tipo: Literal["separador"]


Bloco = Annotated[Union[Titulo, Texto, Destaque, Lista, Cartoes, Metricas, AntesDepois, Links, Citacao, Fluxo,
                        Matriz, Tabela, Separador], Field(discriminator="tipo")]
TIPOS_DE_BLOCO = ("titulo", "texto", "destaque", "lista", "cards", "metricas", "antes-depois", "links", "citacao",
                  "fluxo", "matriz", "tabela", "separador")


class Anotacoes(BaseModel):
    versao: int = Field(ge=0)
    blocos: list[Bloco] = Field(max_length=MAX_BLOCOS)


# ---------- informações contábeis (com grupos) ----------
class SubInfo(BaseModel):
    rotulo: str = Field(default="", max_length=80)
    valor: str = Field(default="", max_length=600)


class ItemInfo(BaseModel):
    """Uma informação solta (`info`) ou um grupo (`grupo`) com várias informações dentro."""

    tipo: Literal["info", "grupo"] = "info"
    rotulo: str = Field(default="", max_length=80)
    valor: str = Field(default="", max_length=600)
    itens: list[SubInfo] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def _forma(self):
        if self.tipo == "info" and self.itens:
            raise ValueError("só um grupo tem itens")
        if self.tipo == "grupo":
            self.valor = ""
        return self


class Infos(BaseModel):
    versao: int = Field(ge=0)
    itens: list[ItemInfo] = Field(max_length=60)


# ---------- do formato antigo (um bloco por linha de lista) para o atual ----------
def migrar_blocos(brutos: list) -> list[dict]:
    """Converte anotações gravadas antes dos blocos do CRM. O que já está no formato novo passa direto."""
    novos: list[dict] = []
    for b in brutos or []:
        if not isinstance(b, dict):
            continue
        t, bid, texto = b.get("tipo"), str(b.get("id") or "")[:40] or "x", str(b.get("texto") or "")
        if t in ("titulo1", "titulo2", "titulo3"):
            novos.append({"id": bid, "tipo": "titulo", "nivel": int(t[-1]), "texto": texto[:200]})
        elif t in ("lista", "numerada", "tarefa") and "itens" not in b:
            estilo = {"lista": "marcadores", "numerada": "numerada", "tarefa": "check"}[t]
            item = {"texto": texto[:300], "feito": bool(b.get("feito"))}
            if novos and novos[-1].get("tipo") == "lista" and novos[-1].get("estilo") == estilo:
                novos[-1]["itens"].append(item)  # linhas seguidas do mesmo tipo viram uma lista só
            else:
                novos.append({"id": bid, "tipo": "lista", "estilo": estilo, "itens": [item]})
        elif t == "destaque" and "tom" not in b:
            novos.append({"id": bid, "tipo": "destaque", "tom": "info", "texto": texto})
        elif t == "citacao" and "autor" not in b:
            novos.append({"id": bid, "tipo": "citacao", "texto": texto[:1000], "autor": ""})
        elif t == "tabela" and "celulas" in b:
            cel = [[str(c)[:300] for c in l][:8] for l in (b.get("celulas") or []) if isinstance(l, list)]
            novos.append({"id": bid, "tipo": "tabela", "colunas": (cel[0] if cel else ["", ""]) or ["", ""],
                          "linhas": cel[1:]})
        elif t in TIPOS_DE_BLOCO:
            novos.append(b)
    return novos


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
