"""Esquema portável: roda igual em SQLite e Postgres.

Sem RLS, sem arrays nativos, sem triggers. UUID como texto e `JSON` genérico.
Colunas fixas para o que se filtra; `dados` (JSON) para o que o usuário inventar.
"""

import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _id() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class StatusVeiculo(str, enum.Enum):
    """Ciclo de vida. Texto no banco (não enum nativo), como manda a doutrina do CRM."""

    DISPONIVEL = "disponivel"
    EM_COMODATO = "em_comodato"
    MANUTENCAO = "manutencao"
    SINISTRADO = "sinistrado"
    BAIXADO = "baixado"


class StatusComodato(str, enum.Enum):
    RASCUNHO = "rascunho"
    GERADO = "gerado"      # documento Word gerado
    ENVIADO = "enviado"    # enviado para assinatura (D4Sign no futuro)
    ASSINADO = "assinado"
    ATIVO = "ativo"
    ENCERRADO = "encerrado"
    CANCELADO = "cancelado"


class Veiculo(Base):
    __tablename__ = "veiculos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    placa: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    chassi: Mapped[str | None] = mapped_column(String(30), unique=True)
    renavam: Mapped[str | None] = mapped_column(String(20))
    marca: Mapped[str | None] = mapped_column(String(60))
    modelo: Mapped[str | None] = mapped_column(String(80))
    ano_fabricacao: Mapped[int | None]
    ano_modelo: Mapped[int | None]
    cor: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default=StatusVeiculo.DISPONIVEL.value, index=True)
    dados: Mapped[dict] = mapped_column(JSON, default=dict)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    eventos: Mapped[list["EventoVeiculo"]] = relationship(
        back_populates="veiculo", order_by="EventoVeiculo.em", cascade="all, delete-orphan"
    )


class EventoVeiculo(Base):
    """Histórico do ciclo de vida: base de 'quem estava com o carro em tal momento'."""

    __tablename__ = "eventos_veiculo"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    veiculo_id: Mapped[str] = mapped_column(ForeignKey("veiculos.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(30))  # mudanca_status, comodato_aberto, ...
    de_status: Mapped[str | None] = mapped_column(String(20))
    para_status: Mapped[str | None] = mapped_column(String(20))
    comodato_id: Mapped[str | None] = mapped_column(ForeignKey("comodatos.id", ondelete="SET NULL"))
    observacao: Mapped[str | None] = mapped_column(Text)
    em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)

    veiculo: Mapped[Veiculo] = relationship(back_populates="eventos")


class Cliente(Base):
    """Entidade que solicita carros regularmente."""

    __tablename__ = "clientes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    nome: Mapped[str] = mapped_column(String(160), index=True)
    documento: Mapped[str | None] = mapped_column(String(20), unique=True)  # CNPJ/CPF, só dígitos
    email: Mapped[str | None] = mapped_column(String(160))
    telefone: Mapped[str | None] = mapped_column(String(30))
    endereco: Mapped[str | None] = mapped_column(Text)
    dados: Mapped[dict] = mapped_column(JSON, default=dict)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Comodato(Base):
    __tablename__ = "comodatos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    numero: Mapped[int] = mapped_column(unique=True, index=True)
    cliente_id: Mapped[str] = mapped_column(ForeignKey("clientes.id"), index=True)
    veiculo_id: Mapped[str] = mapped_column(ForeignKey("veiculos.id"), index=True)
    data_saida: Mapped[date] = mapped_column(Date)
    data_prevista_devolucao: Mapped[date | None] = mapped_column(Date)
    data_devolucao: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default=StatusComodato.RASCUNHO.value, index=True)
    responsavel_nome: Mapped[str | None] = mapped_column(String(160))
    responsavel_contato: Mapped[str | None] = mapped_column(String(160))
    condutor_nome: Mapped[str | None] = mapped_column(String(160))
    condutor_documento: Mapped[str | None] = mapped_column(String(20))
    condutor_cnh: Mapped[str | None] = mapped_column(String(20))
    finalidade: Mapped[str | None] = mapped_column(Text)
    # Qualquer coluna extra da planilha colada vira campo disponível nos modelos Word.
    dados: Mapped[dict] = mapped_column(JSON, default=dict)
    # Reservado para a D4Sign: id do documento lá e situação das assinaturas.
    assinatura: Mapped[dict] = mapped_column(JSON, default=dict)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    cliente: Mapped[Cliente] = relationship()
    veiculo: Mapped[Veiculo] = relationship()


class ModeloDocumento(Base):
    """Um .docx com campos {{...}} que o sistema preenche."""

    __tablename__ = "modelos_documento"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    nome: Mapped[str] = mapped_column(String(120), unique=True)
    arquivo: Mapped[str] = mapped_column(String(255))  # caminho relativo a files_dir
    campos: Mapped[list] = mapped_column(JSON, default=list)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
