"""Dados da tela Início: o que sai, o que volta, a semana e o que pede atenção.

Tudo é calculado na hora a partir dos comodatos e veículos (nada é gravado), então a tela
nunca desatualiza em relação ao cadastro.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Comodato, StatusComodato, StatusVeiculo, Veiculo

DIAS = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]
DIAS_CURTOS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
         "outubro", "novembro", "dezembro"]
ABERTOS = (StatusComodato.RASCUNHO.value, StatusComodato.GERADO.value, StatusComodato.ENVIADO.value,
           StatusComodato.ASSINADO.value, StatusComodato.ATIVO.value)
SEM_ASSINATURA = (StatusComodato.RASCUNHO.value, StatusComodato.GERADO.value, StatusComodato.ENVIADO.value)


def agora() -> datetime:
    return datetime.now(ZoneInfo(get_settings().fuso))


def saudacao(hora: int) -> str:
    return "Bom dia" if hora < 12 else "Boa tarde" if hora < 18 else "Boa noite"


def data_por_extenso(d: date) -> str:
    return f"{DIAS[d.weekday()].capitalize()}, {d.day} de {MESES[d.month - 1]} de {d.year}"


@dataclass
class Alerta:
    tipo: str  # erro | alerta | info
    texto: str


@dataclass
class DiaDaSemana:
    data: date
    rotulo: str
    hoje: bool
    selecionado: bool
    envios: int
    retornos: int


@dataclass
class Inicio:
    saudacao: str
    nome: str
    extenso: str
    hoje: date
    resumo: dict
    envios: list[Comodato] = field(default_factory=list)
    retornos: list[Comodato] = field(default_factory=list)
    semana: list[DiaDaSemana] = field(default_factory=list)
    dia: date | None = None
    do_dia: list[tuple[str, Comodato]] = field(default_factory=list)
    alertas: list[Alerta] = field(default_factory=list)


def _quando(falta: int) -> str:
    return "hoje" if falta == 0 else "amanhã" if falta == 1 else f"em {falta} dias"


def montar(db: Session, dia: date | None = None, *, agora_: datetime | None = None) -> Inicio:
    now = agora_ or agora()
    hoje = now.date()
    dia = dia or hoje
    abertos = db.scalars(select(Comodato).where(Comodato.status.in_(ABERTOS))).all()
    veiculos = db.scalars(select(Veiculo)).all()
    por_status = {s.value: 0 for s in StatusVeiculo}
    for v in veiculos:
        por_status[v.status] = por_status.get(v.status, 0) + 1

    envios = sorted((c for c in abertos if c.data_saida >= hoje), key=lambda c: (c.data_saida, c.numero))
    # Retorno só existe para comodato ainda aberto, com data prevista.
    retornos = sorted((c for c in abertos if c.data_prevista_devolucao and c.data_prevista_devolucao >= hoje),
                      key=lambda c: (c.data_prevista_devolucao, c.numero))

    alertas: list[Alerta] = []
    for c in sorted((c for c in abertos if c.data_prevista_devolucao and c.data_prevista_devolucao < hoje),
                    key=lambda c: c.data_prevista_devolucao):
        atraso = (hoje - c.data_prevista_devolucao).days
        alertas.append(Alerta("erro", f"Devolução atrasada há {atraso} dia{'s' if atraso != 1 else ''}: "
                              f"{c.veiculo.placa} com {c.cliente.nome} (comodato {c.numero:04d})."))
    for c in retornos:
        falta = (c.data_prevista_devolucao - hoje).days
        if falta <= 3:
            alertas.append(Alerta("alerta", f"{c.veiculo.placa} volta {_quando(falta)} ({c.cliente.nome})."))
    for c in envios:
        falta = (c.data_saida - hoje).days
        if falta <= 2 and c.status in SEM_ASSINATURA:
            alertas.append(Alerta("alerta", f"{c.veiculo.placa} sai {_quando(falta)} e o comodato "
                                  f"{c.numero:04d} ainda não foi assinado."))
    for v in veiculos:
        if v.status == StatusVeiculo.SINISTRADO.value:
            alertas.append(Alerta("info", f"{v.placa} está sinistrado."))

    segunda = dia - timedelta(days=dia.weekday())
    semana = []
    for i in range(7):
        d = segunda + timedelta(days=i)
        semana.append(DiaDaSemana(
            data=d, rotulo=DIAS_CURTOS[i], hoje=d == hoje, selecionado=d == dia,
            envios=sum(1 for c in abertos if c.data_saida == d),
            retornos=sum(1 for c in abertos if c.data_prevista_devolucao == d)))
    do_dia = [("Envio", c) for c in abertos if c.data_saida == dia] + \
             [("Retorno", c) for c in abertos if c.data_prevista_devolucao == dia]

    return Inicio(
        saudacao=saudacao(now.hour), nome=get_settings().nome, extenso=data_por_extenso(hoje), hoje=hoje,
        resumo={"total": len(veiculos), "disponiveis": por_status["disponivel"],
                "em_comodato": por_status["em_comodato"], "manutencao": por_status["manutencao"]},
        envios=envios[:6], retornos=retornos[:6], semana=semana, dia=dia, do_dia=do_dia, alertas=alertas)
