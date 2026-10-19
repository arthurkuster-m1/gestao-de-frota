import re
from datetime import date, timedelta
from pathlib import Path

from frota.web.menu import GRUPOS

WEB = Path(__file__).resolve().parent.parent / "frota" / "web"


def test_toda_porta_do_menu_abre(client):
    for _, itens in GRUPOS:
        for i in itens:
            r = client.get(i.href)
            assert r.status_code == 200, i.href
            assert 'aria-current="page"' in r.text, f"{i.href} não acende no menu"


def test_telas_em_breve_dizem_em_breve(client):
    for _, itens in GRUPOS:
        for i in itens:
            if i.breve:
                assert "Em breve" in client.get(i.href).text, i.href


def test_arquivos_do_design_system_existem():
    for arq in ("app.css", "app.js", "icones.svg", "fonts/montserrat-latin-400-normal.woff2",
                "fonts/ibm-plex-mono-latin-400-normal.woff2", "fonts/atkinson-hyperlegible-latin-400-normal.woff2"):
        assert (WEB / "static" / arq).stat().st_size > 0, arq


def test_todo_icone_pedido_existe_no_sprite():
    sprite = (WEB / "static" / "icones.svg").read_text()
    existentes = set(re.findall(r'id="i-([a-z0-9-]+)"', sprite))
    pedidos = set()
    for html in (WEB / "templates").glob("*.html"):
        pedidos |= set(re.findall(r'icone\(\s*"([a-z0-9-]+)"', html.read_text()))
    for i in {i.icone for _, itens in GRUPOS for i in itens}:
        pedidos |= {i, i + "-fill"}
    pedidos |= {n for n in re.findall(r'"([a-z-]+)"', (WEB.parent / "main.py").read_text()) if n in existentes}
    faltando = sorted(p for p in pedidos if p not in existentes)
    assert not faltando, f"ícones que não estão em icones.svg: {faltando}"


def test_css_nao_escreve_cor_nos_templates():
    for html in (WEB / "templates").glob("*.html"):
        assert not re.search(r"#[0-9a-fA-F]{3,8}\b", re.sub(r"&#\d+;", "", html.read_text())), html.name


def test_inicio_mostra_envios_retornos_e_alertas(client):
    hoje = date.today()
    f = lambda d: d.strftime("%d/%m/%Y")  # noqa: E731
    for placa in ("AAA1A11", "BBB2B22", "CCC3C33"):
        client.post("/veiculos", data={"placa": placa, "modelo": "Onix"})
    planilha = (
        "cliente\tplaca\tdata_saida\tdevolucao\n"
        f"Futura Eventos\tAAA1A11\t{f(hoje + timedelta(days=1))}\t{f(hoje + timedelta(days=9))}\n"
        f"Atrasada SA\tBBB2B22\t{f(hoje - timedelta(days=20))}\t{f(hoje - timedelta(days=5))}\n"
        f"Volta Logo\tCCC3C33\t{f(hoje - timedelta(days=3))}\t{f(hoje + timedelta(days=2))}\n"
    )
    client.post("/comodatos/lote", data={"texto": planilha, "confirmar": "1"})
    html = client.get("/inicio").text
    assert "Futura Eventos" in html                                  # próximos envios
    assert "Volta Logo" in html                                      # próximos retornos
    assert "Devolução atrasada há 5 dias: BBB2B22" in html           # alerta vermelho
    assert "CCC3C33 volta em 2 dias" in html                         # alerta amarelo
    assert "AAA1A11 sai amanhã e o comodato" in html                 # saída sem assinatura
    assert "pontos de atenção" in html and "Tudo em dia" not in html
    assert client.get("/inicio?dia=lixo").status_code == 200         # data ruim não derruba a tela


def test_inicio_vazio_diz_tudo_em_dia(client):
    html = client.get("/inicio").text
    assert "Tudo em dia!" in html and "Nenhum envio programado" in html and "Nenhum alerta" in html
