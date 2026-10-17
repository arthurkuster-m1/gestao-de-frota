"""Lê uma tabela colada do Excel (ou um CSV) e a transforma em linhas de comodato.

Puro, sem banco: devolve linhas com os valores já normalizados e os erros de forma.
Quem confere se a placa existe e se o carro está livre é `comodatos.py`.
"""

import csv
import io
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime

# Nome canônico -> apelidos aceitos no cabeçalho da planilha.
APELIDOS: dict[str, tuple[str, ...]] = {
    "cliente_nome": ("cliente", "cliente_nome", "nome_cliente", "razao_social", "empresa"),
    "cliente_documento": ("cnpj", "cpf", "cnpj_cpf", "documento", "cliente_documento", "doc_cliente"),
    "cliente_email": ("email", "e_mail", "cliente_email", "email_cliente"),
    "cliente_telefone": ("telefone", "fone", "celular", "cliente_telefone", "whatsapp"),
    "cliente_endereco": ("endereco", "cliente_endereco"),
    "placa": ("placa", "veiculo", "veiculo_placa"),
    "data_saida": ("data_saida", "saida", "retirada", "data_retirada", "inicio", "data_inicio"),
    "data_prevista_devolucao": (
        "data_prevista_devolucao", "devolucao", "data_devolucao", "previsao_devolucao", "fim", "data_fim", "termino",
    ),
    "responsavel_nome": ("responsavel", "responsavel_nome", "nome_responsavel"),
    "responsavel_contato": ("responsavel_contato", "contato_responsavel", "contato"),
    "condutor_nome": ("condutor", "condutor_nome", "motorista", "nome_condutor"),
    "condutor_documento": ("condutor_documento", "cpf_condutor", "documento_condutor"),
    "condutor_cnh": ("cnh", "condutor_cnh", "cnh_condutor"),
    "finalidade": ("finalidade", "motivo", "evento", "destino"),
}
_INVERSO = {a: canon for canon, apelidos in APELIDOS.items() for a in apelidos}

OBRIGATORIOS = ("cliente_nome", "placa", "data_saida")


def normalizar_cabecalho(texto: str) -> str:
    s = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def normalizar_placa(texto: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", texto.upper())


def so_digitos(texto: str) -> str:
    return re.sub(r"\D", "", texto)


def parse_data(texto: str) -> date | None:
    texto = texto.strip()
    if not texto:
        return None
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"data inválida: {texto!r} (use dd/mm/aaaa)")


@dataclass
class LinhaColada:
    numero: int  # linha na planilha (cabeçalho = 1)
    valores: dict[str, object] = field(default_factory=dict)
    extras: dict[str, str] = field(default_factory=dict)  # colunas desconhecidas
    erros: list[str] = field(default_factory=list)


def _detectar_delimitador(amostra: str) -> str:
    primeira = amostra.splitlines()[0] if amostra.strip() else ""
    for d in ("\t", ";", ","):  # Excel cola com TAB; CSV brasileiro usa ';'
        if d in primeira:
            return d
    return "\t"


def ler_tabela(texto: str) -> tuple[list[str], list[LinhaColada]]:
    """Devolve (colunas_conhecidas_encontradas, linhas)."""
    texto = texto.lstrip("﻿").strip("\r\n")
    if not texto.strip():
        return [], []
    delim = _detectar_delimitador(texto)
    leitor = csv.reader(io.StringIO(texto), delimiter=delim)
    linhas_brutas = [r for r in leitor if any(c.strip() for c in r)]
    cab_brutos = linhas_brutas[0]
    cabecalho = [normalizar_cabecalho(c) for c in cab_brutos]
    canonicos = [_INVERSO.get(c) for c in cabecalho]

    saida: list[LinhaColada] = []
    for i, bruta in enumerate(linhas_brutas[1:], start=2):
        linha = LinhaColada(numero=i)
        for idx, celula in enumerate(bruta[: len(cabecalho)]):
            celula = celula.strip()
            canon = canonicos[idx]
            if canon:
                linha.valores[canon] = celula
            elif cabecalho[idx] and celula:
                linha.extras[cabecalho[idx]] = celula
        _normalizar(linha)
        saida.append(linha)

    encontradas = [c for c in dict.fromkeys(canonicos) if c]
    faltando = [c for c in OBRIGATORIOS if c not in encontradas]
    if faltando:
        for linha in saida:
            linha.erros.append("coluna obrigatória ausente: " + ", ".join(faltando))
    return encontradas, saida


def _normalizar(linha: LinhaColada) -> None:
    v = linha.valores
    if "placa" in v:
        v["placa"] = normalizar_placa(str(v["placa"]))
    for chave in ("cliente_documento", "condutor_documento"):
        if v.get(chave):
            v[chave] = so_digitos(str(v[chave]))
    for chave in ("data_saida", "data_prevista_devolucao"):
        if chave in v:
            try:
                v[chave] = parse_data(str(v[chave]))
            except ValueError as e:
                linha.erros.append(f"{chave}: {e}")
                v[chave] = None
    for chave in OBRIGATORIOS:
        if not v.get(chave) and not any(chave in e for e in linha.erros):
            linha.erros.append(f"{chave} vazio")
