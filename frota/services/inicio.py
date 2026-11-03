"""Dados da tela Início: valores do topo, calendário, avisos, envios e retornos, tarefas.

Tudo é calculado na hora a partir dos comodatos e veículos (nada é gravado), então a tela
nunca desatualiza em relação ao cadastro. Só as anotações e as informações contábeis são
conteúdo gravado (ver `paineis.py`).
"""

import calendar as _cal
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Comodato, StatusComodato, StatusVeiculo, Veiculo

DIAS = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]
DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]  # a semana do calendário começa no domingo
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
         "outubro", "novembro", "dezembro"]
ABERTOS = (StatusComodato.RASCUNHO.value, StatusComodato.GERADO.value, StatusComodato.ENVIADO.value,
           StatusComodato.ASSINADO.value, StatusComodato.ATIVO.value)
SEM_ASSINATURA = (StatusComodato.RASCUNHO.value, StatusComodato.GERADO.value, StatusComodato.ENVIADO.value)
VISTAS = ("dia", "semana", "mes")
# "Comodato" é o uso longo; abaixo disso a saída é "evento" (mesma régua do Tipo no Notion).
LIMITE_COMODATO_LONGO = 30


def agora() -> datetime:
    return datetime.now(ZoneInfo(get_settings().fuso))


def saudacao(hora: int) -> str:
    return "Bom dia" if hora < 12 else "Boa tarde" if hora < 18 else "Boa noite"


def data_por_extenso(d: date) -> str:
    return f"{DIAS[d.weekday()].capitalize()}, {d.day} de {MESES[d.month - 1]} de {d.year}"


def _quando(falta: int) -> str:
    return "hoje" if falta == 0 else "amanhã" if falta == 1 else f"em {falta} dias"


def _domingo_da_semana(d: date) -> date:
    return d - timedelta(days=(d.weekday() + 1) % 7)


@dataclass
class Aviso:
    tipo: str  # erro | alerta | info
    texto: str
    href: str  # todo aviso leva ao assunto de que fala


@dataclass
class Tarefa:
    texto: str
    prazo: date
    href: str
    atrasada: bool
    curto: str = ""  # frase enxuta para o calendário


@dataclass
class Evento:
    dia: date
    tipo: str  # envio | retorno | tarefa
    titulo: str
    detalhe: str
    href: str
    feito: bool = False
    curto: str = ""  # texto enxuto para a célula do mês


@dataclass
class Celula:
    data: date
    fora: bool  # dia de outro mês (só na vista de mês)
    hoje: bool
    selecionado: bool
    eventos: list[Evento] = field(default_factory=list)


@dataclass
class Calendario:
    vista: str
    dia: date
    titulo: str
    anterior: date
    proximo: date
    celulas: list[Celula]  # vazio na vista de dia
    do_dia: list[Evento]
    dia_extenso: str = ""
    cabecalho: list[str] = field(default_factory=lambda: list(DIAS_CURTOS))


@dataclass
class Inicio:
    saudacao: str
    nome: str
    extenso: str
    hoje: date
    valores: dict
    calendario: Calendario
    avisos: list[Aviso]
    envios: list[Comodato]
    retornos: list[Comodato]
    tarefas: list[Tarefa]


def _href_comodato(c: Comodato) -> str:
    return f"/comodatos#c-{c.numero}"


def _tarefas(abertos: list[Comodato], hoje: date) -> list[Tarefa]:
    """Próximas ações do processo, derivadas do estado de cada comodato aberto.

    Ainda não existe tarefa digitada à mão: estas saem do que falta fazer em cada contrato.
    """
    saida: list[Tarefa] = []
    for c in abertos:
        h, rot = _href_comodato(c), f"{c.numero:04d}"
        if c.status == StatusComodato.RASCUNHO.value:
            saida.append(Tarefa(f"Gerar o Word do comodato {rot} ({c.cliente.nome})", c.data_saida, h, c.data_saida < hoje, f"Gerar Word {rot}"))
        elif c.status == StatusComodato.GERADO.value:
            saida.append(Tarefa(f"Enviar o comodato {rot} para assinatura ({c.cliente.nome})", c.data_saida, h, c.data_saida < hoje, f"Enviar p/ assinar {rot}"))
        elif c.status == StatusComodato.ENVIADO.value:
            saida.append(Tarefa(f"Acompanhar a assinatura do comodato {rot} ({c.cliente.nome})", c.data_saida, h, c.data_saida < hoje, f"Acompanhar assinatura {rot}"))
        elif c.status == StatusComodato.ASSINADO.value and hoje <= c.data_saida <= hoje + timedelta(days=3):
            saida.append(Tarefa(f"Confirmar o envio de {c.veiculo.placa} para {c.cliente.nome}", c.data_saida, h, False, f"Confirmar envio {c.veiculo.placa}"))
        prev = c.data_prevista_devolucao
        if prev and prev < hoje:
            saida.append(Tarefa(f"Cobrar a devolução de {c.veiculo.placa} ({c.cliente.nome})", prev, h, True, f"Cobrar devolução {c.veiculo.placa}"))
        elif prev and prev <= hoje + timedelta(days=3):
            saida.append(Tarefa(f"Solicitar o retorno de {c.veiculo.placa} ({c.cliente.nome})", prev, h, False, f"Solicitar retorno {c.veiculo.placa}"))
    return sorted(saida, key=lambda t: (t.prazo, t.texto))


def _eventos(comodatos: list[Comodato], tarefas: list[Tarefa], ini: date, fim: date) -> dict[date, list[Evento]]:
    por_dia: dict[date, list[Evento]] = {}

    def add(e: Evento):
        if ini <= e.dia <= fim:
            por_dia.setdefault(e.dia, []).append(e)

    for c in comodatos:
        det = f"{c.veiculo.placa} · {c.veiculo.modelo or ''}".strip(" ·")
        h = _href_comodato(c)
        placa = c.veiculo.placa
        add(Evento(c.data_saida, "envio", f"Envio · {c.cliente.nome}", det, h, curto=placa))
        if c.status == StatusComodato.ENCERRADO.value:
            if c.data_devolucao:
                add(Evento(c.data_devolucao, "retorno", f"Retornou · {c.cliente.nome}", det, h, feito=True,
                           curto=placa))
        elif c.data_prevista_devolucao:
            add(Evento(c.data_prevista_devolucao, "retorno", f"Retorno · {c.cliente.nome}", det, h,
                       curto=placa))
    for t in tarefas:
        add(Evento(t.prazo, "tarefa", t.texto, "Tarefa", t.href, curto=t.curto or t.texto))
    ordem = {"envio": 0, "retorno": 1, "tarefa": 2}
    for lst in por_dia.values():
        lst.sort(key=lambda e: (ordem[e.tipo], e.titulo))
    return por_dia


def _mes_somado(d: date, n: int) -> date:
    m = d.month - 1 + n
    ano, mes = d.year + m // 12, m % 12 + 1
    return date(ano, mes, min(d.day, _cal.monthrange(ano, mes)[1]))


def _calendario(vista: str, dia: date, hoje: date, comodatos, tarefas) -> Calendario:
    if vista == "mes":
        primeiro = dia.replace(day=1)
        ini = _domingo_da_semana(primeiro)
        fim = ini + timedelta(days=41)
        titulo = f"{MESES[dia.month - 1].capitalize()} de {dia.year}"
        ant, prox = _mes_somado(dia, -1), _mes_somado(dia, 1)
    elif vista == "semana":
        ini = _domingo_da_semana(dia)
        fim = ini + timedelta(days=6)
        mes_ini = MESES[ini.month - 1]
        titulo = (f"{ini.day} a {fim.day} de {mes_ini} de {fim.year}" if ini.month == fim.month else
                  f"{ini.day} de {mes_ini} a {fim.day} de {MESES[fim.month - 1]} de {fim.year}")
        ant, prox = dia - timedelta(days=7), dia + timedelta(days=7)
    else:
        ini = fim = dia
        titulo = data_por_extenso(dia)
        ant, prox = dia - timedelta(days=1), dia + timedelta(days=1)
    eventos = _eventos(comodatos, tarefas, ini, fim)
    celulas = []
    if vista != "dia":
        for i in range((fim - ini).days + 1):
            d = ini + timedelta(days=i)
            celulas.append(Celula(d, vista == "mes" and d.month != dia.month, d == hoje, d == dia, eventos.get(d, [])))
    return Calendario(vista, dia, titulo, ant, prox, celulas, eventos.get(dia, []), data_por_extenso(dia))


def montar(db: Session, dia: date | None = None, vista: str = "mes", *, agora_: datetime | None = None) -> Inicio:
    now = agora_ or agora()
    hoje = now.date()
    dia = dia or hoje
    vista = vista if vista in VISTAS else "mes"
    todos = db.scalars(select(Comodato).where(Comodato.status != StatusComodato.CANCELADO.value)).all()
    abertos = [c for c in todos if c.status in ABERTOS]
    veiculos = db.scalars(select(Veiculo)).all()

    # ---- valores do topo ----
    por_status = {s.value: 0 for s in StatusVeiculo}
    for v in veiculos:
        por_status[v.status] = por_status.get(v.status, 0) + 1
    aberto_do_veiculo = {c.veiculo_id: c for c in sorted(abertos, key=lambda c: c.numero)}
    em_evento = em_comodato = 0
    for v in veiculos:
        if v.status != StatusVeiculo.EM_COMODATO.value:
            continue
        c = aberto_do_veiculo.get(v.id)
        dur = (c.data_prevista_devolucao - c.data_saida).days if c and c.data_prevista_devolucao else None
        if dur is None or dur > LIMITE_COMODATO_LONGO:  # sem data de volta = uso longo
            em_comodato += 1
        else:
            em_evento += 1
    valores = {
        "total": len(veiculos),
        # Definição provisória (a final sai do motor de Veículos): tudo que não foi baixado.
        "ativos": len(veiculos) - por_status[StatusVeiculo.BAIXADO.value],
        "disponiveis": por_status[StatusVeiculo.DISPONIVEL.value],
        "em_evento": em_evento,
        "em_comodato": em_comodato,
    }

    # ---- envios e retornos ----
    envios = sorted((c for c in abertos if c.data_saida >= hoje), key=lambda c: (c.data_saida, c.numero))
    retornos = sorted((c for c in abertos if c.data_prevista_devolucao and c.data_prevista_devolucao >= hoje),
                      key=lambda c: (c.data_prevista_devolucao, c.numero))

    # ---- avisos: cada um leva ao assunto ----
    avisos: list[Aviso] = []
    for c in sorted((c for c in abertos if c.data_prevista_devolucao and c.data_prevista_devolucao < hoje),
                    key=lambda c: c.data_prevista_devolucao):
        atraso = (hoje - c.data_prevista_devolucao).days
        avisos.append(Aviso("erro", f"Devolução atrasada há {atraso} dia{'s' if atraso != 1 else ''}: "
                            f"{c.veiculo.placa} com {c.cliente.nome} (comodato {c.numero:04d}).", _href_comodato(c)))
    for c in retornos:
        falta = (c.data_prevista_devolucao - hoje).days
        if falta <= 3:
            avisos.append(Aviso("alerta", f"{c.veiculo.placa} volta {_quando(falta)} ({c.cliente.nome}).", _href_comodato(c)))
    for c in envios:
        falta = (c.data_saida - hoje).days
        if falta <= 2 and c.status in SEM_ASSINATURA:
            avisos.append(Aviso("alerta", f"{c.veiculo.placa} sai {_quando(falta)} e o comodato "
                                f"{c.numero:04d} ainda não foi assinado.", _href_comodato(c)))
    for v in veiculos:
        if v.status == StatusVeiculo.SINISTRADO.value:
            avisos.append(Aviso("info", f"{v.placa} está sinistrado.", f"/veiculos/{v.id}"))

    tarefas = _tarefas(abertos, hoje)
    return Inicio(
        saudacao=saudacao(now.hour), nome=get_settings().nome, extenso=data_por_extenso(hoje), hoje=hoje,
        valores=valores, calendario=_calendario(vista, dia, hoje, todos, tarefas), avisos=avisos,
        envios=envios[:8], retornos=retornos[:8], tarefas=tarefas[:8])
