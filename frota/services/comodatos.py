from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import (
    Cliente, Comodato, EventoVeiculo, StatusComodato, StatusVeiculo, Veiculo,
)
from .colagem import LinhaColada


class ErroDeNegocio(Exception):
    pass


def mudar_status_veiculo(db: Session, veiculo: Veiculo, novo: str, *, tipo="mudanca_status",
                         comodato_id: str | None = None, observacao: str | None = None) -> None:
    if novo not in {s.value for s in StatusVeiculo}:
        raise ErroDeNegocio(f"status inválido: {novo}")
    antigo = veiculo.status
    veiculo.status = novo
    db.add(EventoVeiculo(veiculo_id=veiculo.id, tipo=tipo, de_status=antigo, para_status=novo,
                         comodato_id=comodato_id, observacao=observacao))


def _proximo_numero(db: Session) -> int:
    return (db.scalar(select(func.max(Comodato.numero))) or 0) + 1


def obter_ou_criar_cliente(db: Session, v: dict) -> Cliente:
    doc = v.get("cliente_documento") or None
    cliente = None
    if doc:
        cliente = db.scalar(select(Cliente).where(Cliente.documento == doc))
    if cliente is None:
        cliente = db.scalar(select(Cliente).where(func.lower(Cliente.nome) == str(v["cliente_nome"]).lower()))
    if cliente is None:
        cliente = Cliente(nome=v["cliente_nome"], documento=doc)
        db.add(cliente)
    for campo, chave in (("email", "cliente_email"), ("telefone", "cliente_telefone"),
                         ("endereco", "cliente_endereco")):
        if v.get(chave) and not getattr(cliente, campo):
            setattr(cliente, campo, v[chave])
    if doc and not cliente.documento:
        cliente.documento = doc
    db.flush()
    return cliente


CAMPOS_DO_COMODATO = (
    "data_saida", "data_prevista_devolucao", "responsavel_nome", "responsavel_contato",
    "condutor_nome", "condutor_documento", "condutor_cnh", "finalidade",
)


def criar_comodato(db: Session, v: dict, extras: dict | None = None) -> Comodato:
    """Cria o comodato e move o carro para `em_comodato`. Levanta ErroDeNegocio se não der."""
    placa = v["placa"]
    veiculo = db.scalar(select(Veiculo).where(Veiculo.placa == placa))
    if veiculo is None:
        raise ErroDeNegocio(f"placa {placa} não cadastrada")
    if veiculo.status != StatusVeiculo.DISPONIVEL.value:
        raise ErroDeNegocio(f"{placa} não está disponível (status: {veiculo.status})")
    prevista = v.get("data_prevista_devolucao")
    if prevista and prevista < v["data_saida"]:
        raise ErroDeNegocio("devolução prevista anterior à saída")

    cliente = obter_ou_criar_cliente(db, v)
    com = Comodato(
        numero=_proximo_numero(db), cliente_id=cliente.id, veiculo_id=veiculo.id,
        status=StatusComodato.RASCUNHO.value, dados=dict(extras or {}),
        **{c: v.get(c) or None for c in CAMPOS_DO_COMODATO},
    )
    db.add(com)
    db.flush()
    mudar_status_veiculo(db, veiculo, StatusVeiculo.EM_COMODATO.value, tipo="comodato_aberto",
                         comodato_id=com.id, observacao=f"Comodato #{com.numero} · {cliente.nome}")
    return com


def encerrar_comodato(db: Session, com: Comodato, quando: date | None = None) -> None:
    if com.status in (StatusComodato.ENCERRADO.value, StatusComodato.CANCELADO.value):
        raise ErroDeNegocio("comodato já encerrado")
    com.status = StatusComodato.ENCERRADO.value
    com.data_devolucao = quando or date.today()
    mudar_status_veiculo(db, com.veiculo, StatusVeiculo.DISPONIVEL.value, tipo="comodato_encerrado",
                         comodato_id=com.id)


def validar_lote(db: Session, linhas: list[LinhaColada]) -> None:
    """Acrescenta aos `erros` de cada linha o que depende do banco.

    Também pega a mesma placa duas vezes na própria planilha (o 2º pedido nunca teria o carro livre).
    """
    vistas: dict[str, int] = {}
    for linha in linhas:
        if linha.erros:
            continue
        placa = linha.valores["placa"]
        if placa in vistas:
            linha.erros.append(f"placa {placa} repetida (linha {vistas[placa]})")
            continue
        vistas[placa] = linha.numero
        veic = db.scalar(select(Veiculo).where(Veiculo.placa == placa))
        if veic is None:
            linha.erros.append(f"placa {placa} não cadastrada")
        elif veic.status != StatusVeiculo.DISPONIVEL.value:
            linha.erros.append(f"{placa} não está disponível ({veic.status})")


def criar_lote(db: Session, linhas: list[LinhaColada]) -> list[Comodato]:
    """Cria só as linhas sem erro. Tudo-ou-nada por linha, não pelo lote."""
    validar_lote(db, linhas)
    criados = []
    for linha in linhas:
        if linha.erros:
            continue
        try:
            with db.begin_nested():
                criados.append(criar_comodato(db, linha.valores, linha.extras))
        except ErroDeNegocio as e:
            linha.erros.append(str(e))
    db.commit()
    return criados
