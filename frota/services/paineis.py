"""Anotações (editor de blocos, os mesmos tipos do CRM) e informações contábeis da tela Início.

O servidor valida a forma de tudo que grava: o editor do navegador é conveniência, não garantia.
"""

import re
from datetime import datetime, timezone
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field, TypeAdapter, ValidationError, field_validator, model_validator
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import Painel

MAX_BLOCOS = 300
_ID = Field(min_length=1, max_length=40)
_URL = re.compile(r"^https?://[^\s]+$", re.I)


# ---------- blocos (os mesmos do CRM: editor das notas das tarefas + blocos visuais das estratégias) ----------
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


class BlocoTexto(BaseModel):
    """Um bloco de texto (uma linha, como no Notion). Pode ter blocos dentro (`filhos`): recuo e toggle."""

    id: str = _ID
    tipo: Literal["texto", "titulo", "tarefa", "marcador", "numerada", "toggle", "citacao", "destaque"]
    texto: str = Field(default="", max_length=5000)
    nivel: Literal[1, 2, 3] | None = None  # título
    marcado: bool | None = None  # tarefa
    aberto: bool | None = None  # toggle
    tom: Literal["info", "sucesso", "atencao"] | None = None  # destaque
    autor: str | None = Field(default=None, max_length=120)  # citação
    alinhamento: Literal["esquerda", "centro", "direita"] | None = None
    filhos: list["BlocoTexto"] = Field(default_factory=list, max_length=200)


BlocoTexto.model_rebuild()


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


Bloco = Annotated[Union[BlocoTexto, Cartoes, Metricas, AntesDepois, Links, Fluxo, Matriz, Tabela, Separador],
                  Field(discriminator="tipo")]
TIPOS_DE_TEXTO = ("texto", "titulo", "tarefa", "marcador", "numerada", "toggle", "citacao", "destaque")
TIPOS_VISUAIS = ("cards", "metricas", "antes-depois", "links", "fluxo", "matriz", "tabela", "separador")
MAX_BLOCOS = 500  # no total, contando os blocos de dentro
MAX_NIVEIS = 5  # quantos níveis de recuo cabem (o editor do CRM aceita o mesmo)


def _conta(blocos, nivel=0) -> tuple[int, int]:
    """(quantos blocos no total, nível mais fundo) de uma lista com blocos dentro de blocos."""
    total, fundo = 0, nivel
    for b in blocos:
        total += 1
        if isinstance(b, BlocoTexto) and b.filhos:
            t, f = _conta(b.filhos, nivel + 1)
            total, fundo = total + t, max(fundo, f)
    return total, fundo


class Anotacoes(BaseModel):
    versao: int = Field(ge=0)
    blocos: list[Bloco] = Field(max_length=MAX_BLOCOS)

    @model_validator(mode="after")
    def _limites(self):
        total, fundo = _conta(self.blocos)
        if total > MAX_BLOCOS:
            raise ValueError("blocos demais")
        if fundo > MAX_NIVEIS:
            raise ValueError("recuo fundo demais")
        return self


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


# ---------- dos formatos antigos para o atual ----------
_ADAPTADOR = TypeAdapter(Bloco)


def _valido(b: dict) -> dict | None:
    try:
        return _ADAPTADOR.validate_python(b).model_dump(exclude_none=True)
    except ValidationError:
        return None


def migrar_blocos(brutos: list) -> list[dict]:
    """Converte anotações gravadas pelos editores anteriores para o formato atual.

    1ª versão: um bloco por linha (`titulo1`, `tarefa` com `feito`, `lista`/`numerada` com `texto`, tabela em `celulas`).
    2ª versão: `lista` com `itens` (cada item vira um bloco de uma linha), `tabela` com `colunas`/`linhas`.
    O que já está no formato atual passa direto. Bloco que não valida é descartado, nunca derruba a tela.
    """
    novos: list[dict] = []
    for b in brutos or []:
        if not isinstance(b, dict):
            continue
        t, bid, texto = b.get("tipo"), str(b.get("id") or "")[:36] or "x", str(b.get("texto") or "")
        saida: list[dict] = []
        if t in ("titulo1", "titulo2", "titulo3"):
            saida = [{"id": bid, "tipo": "titulo", "nivel": int(t[-1]), "texto": texto[:5000]}]
        elif t == "lista" and "itens" in b:  # 2ª versão: uma lista com itens
            tipo = {"marcadores": "marcador", "numerada": "numerada", "check": "tarefa"}.get(b.get("estilo"), "marcador")
            for n, item in enumerate(b.get("itens") or []):
                item = item if isinstance(item, dict) else {"texto": str(item)}
                novo = {"id": f"{bid}-{n}", "tipo": tipo, "texto": str(item.get("texto") or "")[:5000]}
                if tipo == "tarefa":
                    novo["marcado"] = bool(item.get("feito"))
                saida.append(novo)
        elif t == "lista":  # 1ª versão: marcador de uma linha
            saida = [{"id": bid, "tipo": "marcador", "texto": texto[:5000]}]
        elif t == "tarefa":
            saida = [{"id": bid, "tipo": "tarefa", "texto": texto[:5000], "marcado": bool(b.get("marcado", b.get("feito")))}]
        elif t == "tabela" and "celulas" in b:
            cel = [[str(c)[:300] for c in l][:8] for l in (b.get("celulas") or []) if isinstance(l, list)]
            saida = [{"id": bid, "tipo": "tabela", "colunas": (cel[0] if cel else ["", ""]) or ["", ""], "linhas": cel[1:]}]
        elif t == "destaque" and "tom" not in b:
            saida = [{**b, "tom": "info"}]
        elif t in TIPOS_DE_TEXTO or t in TIPOS_VISUAIS:
            saida = [b]
        for item in saida:
            ok = _valido(item)
            if ok:
                novos.append(ok)
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
