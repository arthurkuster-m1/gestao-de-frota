"""Preenche um modelo Word com os dados do comodato e devolve o .docx."""

import io
import re
import uuid
import zipfile
from datetime import date
from pathlib import Path

from docxtpl import DocxTemplate
from jinja2 import Environment, StrictUndefined

from ..config import get_settings
from ..models import Comodato, ModeloDocumento

MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
         "setembro", "outubro", "novembro", "dezembro"]


def _data(d: date | None) -> str:
    return d.strftime("%d/%m/%Y") if d else ""


def _extenso(d: date | None) -> str:
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}" if d else ""


def _cnpj_cpf(s: str | None) -> str:
    s = re.sub(r"\D", "", s or "")
    if len(s) == 14:
        return f"{s[:2]}.{s[2:5]}.{s[5:8]}/{s[8:12]}-{s[12:]}"
    if len(s) == 11:
        return f"{s[:3]}.{s[3:6]}.{s[6:9]}-{s[9:]}"
    return s


def contexto_do_comodato(com: Comodato) -> dict:
    """Todos os campos que um modelo Word pode usar, em chaves planas: {{cliente_nome}} etc."""
    c, v = com.cliente, com.veiculo
    ctx = {
        # extras da planilha primeiro, para os campos oficiais nunca serem sobrescritos
        **{k: ("" if val is None else val) for k, val in (com.dados or {}).items()},
        "numero": f"{com.numero:04d}",
        "ano": com.data_saida.year,
        "data_hoje": _data(date.today()),
        "data_hoje_extenso": _extenso(date.today()),
        "cliente_nome": c.nome,
        "cliente_documento": _cnpj_cpf(c.documento),
        "cliente_email": c.email or "",
        "cliente_telefone": c.telefone or "",
        "cliente_endereco": c.endereco or "",
        "veiculo_placa": v.placa,
        "veiculo_marca": v.marca or "",
        "veiculo_modelo": v.modelo or "",
        "veiculo_chassi": v.chassi or "",
        "veiculo_renavam": v.renavam or "",
        "veiculo_cor": v.cor or "",
        "veiculo_ano": f"{v.ano_fabricacao or ''}/{v.ano_modelo or ''}".strip("/"),
        "data_saida": _data(com.data_saida),
        "data_saida_extenso": _extenso(com.data_saida),
        "data_prevista_devolucao": _data(com.data_prevista_devolucao),
        "data_prevista_devolucao_extenso": _extenso(com.data_prevista_devolucao),
        "responsavel_nome": com.responsavel_nome or "",
        "responsavel_contato": com.responsavel_contato or "",
        "condutor_nome": com.condutor_nome or "",
        "condutor_documento": _cnpj_cpf(com.condutor_documento),
        "condutor_cnh": com.condutor_cnh or "",
        "finalidade": com.finalidade or "",
    }
    return ctx


def campos_do_modelo(caminho: Path) -> list[str]:
    return sorted(DocxTemplate(str(caminho)).get_undeclared_template_variables())


def salvar_modelo(db, nome: str, conteudo: bytes) -> ModeloDocumento:
    """Valida que é um .docx legível, guarda o arquivo e lista os campos {{...}} encontrados."""
    if not zipfile.is_zipfile(io.BytesIO(conteudo)):
        raise ValueError("o arquivo não é um .docx válido")
    pasta = get_settings().files_dir / "modelos"
    pasta.mkdir(parents=True, exist_ok=True)
    rel = f"modelos/{uuid.uuid4()}.docx"
    destino = get_settings().files_dir / rel
    destino.write_bytes(conteudo)
    try:
        campos = campos_do_modelo(destino)
    except Exception as e:  # campo mal formado no Word, por exemplo '{{ ' sem fechar
        destino.unlink(missing_ok=True)
        raise ValueError(f"não consegui ler os campos do modelo: {e}") from e
    modelo = ModeloDocumento(nome=nome, arquivo=rel, campos=campos)
    db.add(modelo)
    db.commit()
    return modelo


def gerar_docx(modelo: ModeloDocumento, com: Comodato) -> bytes:
    """Campo do modelo que o sistema não conhece vira erro claro, não texto vazio no contrato."""
    env = Environment(undefined=StrictUndefined, autoescape=True)
    doc = DocxTemplate(str(get_settings().files_dir / modelo.arquivo))
    doc.render(contexto_do_comodato(com), jinja_env=env)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def nome_do_arquivo(modelo: ModeloDocumento, com: Comodato) -> str:
    base = re.sub(r"[^A-Za-z0-9_-]+", "_", f"{modelo.nome}_{com.numero:04d}_{com.veiculo.placa}")
    return base + ".docx"


def gerar_zip(modelo: ModeloDocumento, comodatos: list[Comodato]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for com in comodatos:
            z.writestr(nome_do_arquivo(modelo, com), gerar_docx(modelo, com))
    return buf.getvalue()
