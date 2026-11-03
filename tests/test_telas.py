import json
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
                "fonts/atkinson-hyperlegible-latin-400-normal.woff2"):
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


def _frota_de_exemplo(client, hoje):
    f = lambda d: d.strftime("%d/%m/%Y")  # noqa: E731
    for placa in ("AAA1A11", "BBB2B22", "CCC3C33", "DDD4D44"):
        client.post("/veiculos", data={"placa": placa, "modelo": "Onix"})
    planilha = (
        "cliente\tplaca\tdata_saida\tdevolucao\n"
        f"Futura Eventos\tAAA1A11\t{f(hoje + timedelta(days=1))}\t{f(hoje + timedelta(days=9))}\n"       # evento (8 dias)
        f"Atrasada SA\tBBB2B22\t{f(hoje - timedelta(days=20))}\t{f(hoje - timedelta(days=5))}\n"          # atrasada
        f"Volta Logo\tCCC3C33\t{f(hoje - timedelta(days=3))}\t{f(hoje + timedelta(days=2))}\n"            # volta em 2 dias
        f"Contrato Longo\tDDD4D44\t{f(hoje - timedelta(days=1))}\t{f(hoje + timedelta(days=90))}\n"       # comodato > 1 mês
    )
    client.post("/comodatos/lote", data={"texto": planilha, "confirmar": "1"})


def test_inicio_valores_do_topo(client):
    _frota_de_exemplo(client, date.today())
    client.post("/veiculos", data={"placa": "EEE5E55"})  # disponível
    html = client.get("/inicio").text
    ordem = ["Total de veículos", "Ativos", "Disponíveis", "Em evento", "Em comodato"]
    assert [html.index(t) for t in ordem] == sorted(html.index(t) for t in ordem)
    v = re.findall(r'class="rotulo">([^<]+(?:<span[^<]*</span>)?)</div><div class="valor">(\d+)', html)
    valores = {re.sub(r"<[^>]+>", "", r).split("(")[0].strip(): int(n) for r, n in v}
    # 5 veículos; 4 em uso: 3 saídas de até 1 mês viram "evento" e 1 de 91 dias vira "comodato"
    assert valores == {"Total de veículos": 5, "Ativos": 5, "Disponíveis": 1, "Em evento": 3, "Em comodato": 1}


def test_inicio_ordem_dos_blocos(client):
    html = client.get("/inicio").text
    ordem = ["boas-vindas", 'id="calendario"', 'id="avisos"', "Próximos envios e retornos", "Próximas tarefas",
             "Anotações", "Infos contábeis"]
    pos = [html.index(t) for t in ordem]
    assert pos == sorted(pos), dict(zip(ordem, pos))


def test_avisos_sao_clicaveis_e_levam_ao_assunto(client):
    _frota_de_exemplo(client, date.today())
    html = client.get("/inicio").text
    avisos = re.findall(r'<a class="msg[^"]*aviso-link" href="([^"]+)"><svg.*?<div>([^<]+)</div>', html, re.S)
    textos = {t: h for h, t in avisos}
    atraso = next(h for t, h in textos.items() if t.startswith("Devolução atrasada há 5 dias: BBB2B22"))
    assert atraso.startswith("/comodatos#c-")
    assert any("CCC3C33 volta em 2 dias" in t for t in textos)
    assert any("AAA1A11 sai amanhã" in t for t in textos)
    pagina = client.get("/comodatos").text
    for href in {h for h in textos.values()}:
        assert f'id="{href.split("#")[1]}"' in pagina, href  # o destino existe na página


def test_sinistrado_leva_ao_veiculo(client):
    client.post("/veiculos", data={"placa": "SIN1A11"})
    vid = re.search(r"/veiculos/([0-9a-f-]{36})", client.get("/veiculos").text).group(1)
    client.post(f"/veiculos/{vid}/status", data={"status": "sinistrado"})
    assert f'href="/veiculos/{vid}"' in client.get("/inicio").text


def test_proximos_envios_e_retornos_num_bloco_so(client):
    _frota_de_exemplo(client, date.today())
    html = client.get("/inicio").text
    bloco = html[html.index("Próximos envios e retornos"):html.index("Próximas tarefas")]
    assert "Envios" in bloco and "Retornos" in bloco
    assert "Futura Eventos" in bloco and "Volta Logo" in bloco and "Atrasada SA" not in bloco  # atrasada é aviso


def test_tarefas_derivadas_do_andamento_dos_contratos(client):
    _frota_de_exemplo(client, date.today())
    html = client.get("/inicio").text
    tarefas = html[html.index("Próximas tarefas"):html.index("Anotações")]
    assert "Gerar o Word do comodato" in tarefas
    assert "Cobrar a devolução de BBB2B22" in tarefas and "atrasada" in tarefas
    assert "Solicitar o retorno de CCC3C33" in tarefas


def test_calendario_tres_visualizacoes_e_navegacao(client):
    hoje = date.today()
    _frota_de_exemplo(client, hoje)
    mes = client.get("/inicio?vista=mes").text
    assert mes.count('class="mes-cel') == 42 and "DOM" not in mes.upper().split("MES-SEM")[0]
    assert re.search(r'class="ev ev-envio[^"]*"[^>]*title="Envio · Futura Eventos[^"]*"><i></i><span>AAA1A11</span>', mes)
    assert re.search(r'class="ev ev-retorno[^"]*"[^>]*title="Retorno · Volta Logo[^"]*"><i></i><span>CCC3C33</span>', mes)
    sem = client.get("/inicio?vista=semana").text
    assert sem.count('class="sem-col') == 7
    dia = client.get(f"/inicio?vista=dia&dia={hoje.isoformat()}").text
    assert "mes-cel" not in dia and "sem-col" not in dia
    # avançar e voltar para qualquer mês/dia
    futuro = date(hoje.year + 1, 3, 15)
    pg = client.get(f"/inicio?vista=mes&dia={futuro.isoformat()}").text
    assert "Março de " + str(futuro.year) in pg and 'aria-label="Próximo"' in pg
    assert "vista=mes&dia=" + date(futuro.year, 4, 15).isoformat() in pg
    assert client.get("/inicio?vista=semana&dia=2020-02-29").status_code == 200
    assert client.get("/inicio?vista=qualquer&dia=lixo").status_code == 200  # parâmetro ruim não derruba
    # eventos do calendário levam ao contrato
    assert "/comodatos#c-" in mes


def test_calendario_mostra_historico_de_meses_passados(client):
    hoje = date.today()
    client.post("/veiculos", data={"placa": "OLD1A11"})
    ontem = (hoje - timedelta(days=40)).strftime("%d/%m/%Y")
    client.post("/comodatos/lote", data={"texto": f"cliente\tplaca\tdata_saida\tdevolucao\nAntigo\tOLD1A11\t{ontem}\t{(hoje - timedelta(days=35)).strftime('%d/%m/%Y')}", "confirmar": "1"})
    from sqlalchemy import select
    from frota import db as dbmod
    from frota.models import Comodato
    with dbmod.SessionLocal() as db:
        cid = db.scalar(select(Comodato.id))
    client.post(f"/comodatos/{cid}/encerrar")
    passado = (hoje - timedelta(days=40)).isoformat()
    assert re.search(r"ev-envio[^>]*title=\"Envio · Antigo", client.get(f"/inicio?vista=mes&dia={passado}").text)


def test_inicio_vazio_diz_tudo_em_dia(client):
    html = client.get("/inicio").text
    assert "Tudo em dia!" in html and "Nenhum envio programado" in html and "Nenhum retorno previsto" in html
    assert "Sem tarefas por enquanto" in html


def test_anotacoes_gravam_e_voltam_na_pagina(client):
    blocos = [{"id": "a1", "tipo": "titulo1", "texto": "Reunião"}, {"id": "a2", "tipo": "tarefa", "texto": "Ligar", "feito": True},
              {"id": "a3", "tipo": "tabela", "celulas": [["x", "y"], ["1", "2"]]}, {"id": "a4", "tipo": "separador"}]
    r = client.put("/api/inicio/anotacoes", json={"versao": 0, "blocos": blocos})
    assert r.status_code == 200 and r.json() == {"ok": True, "versao": 1}
    html = client.get("/inicio").text
    dados = json.loads(re.search(r'id="dados-anotacoes">(.*?)</script>', html, re.S).group(1))
    assert dados["versao"] == 1 and [b["tipo"] for b in dados["blocos"]] == ["titulo1", "tarefa", "tabela", "separador"]
    assert dados["blocos"][0]["texto"] == "Reunião" and dados["blocos"][1]["feito"] is True
    assert dados["blocos"][2]["celulas"] == [["x", "y"], ["1", "2"]]
    r = client.put("/api/inicio/anotacoes", json={"versao": 1, "blocos": blocos[:1]})
    assert r.json()["versao"] == 2


def test_anotacoes_recusam_gravar_por_cima_de_outro_aparelho(client):
    um = [{"id": "a", "tipo": "texto", "texto": "do celular"}]
    assert client.put("/api/inicio/anotacoes", json={"versao": 0, "blocos": um}).status_code == 200
    r = client.put("/api/inicio/anotacoes", json={"versao": 0, "blocos": [{"id": "b", "tipo": "texto", "texto": "do PC"}]})
    assert r.status_code == 409 and r.json()["erro"] == "conflito"
    assert "do celular" in client.get("/inicio").text and "do PC" not in client.get("/inicio").text


def test_anotacoes_validam_a_forma(client):
    ruim = lambda b: client.put("/api/inicio/anotacoes", json={"versao": 0, "blocos": b}).status_code  # noqa: E731
    assert ruim([{"id": "a", "tipo": "script", "texto": "x"}]) == 422          # tipo desconhecido
    assert ruim([{"id": "a", "tipo": "texto", "texto": "x" * 5001}]) == 422    # grande demais
    assert ruim([{"id": "a", "tipo": "texto"}] * 501) == 422                   # blocos demais
    assert ruim([{"id": "a", "tipo": "tabela", "celulas": [["x"] * 11]}]) == 422


def test_anotacao_com_html_nao_vira_html_na_pagina(client):
    client.put("/api/inicio/anotacoes", json={"versao": 0, "blocos": [{"id": "a", "tipo": "texto", "texto": "</script><img src=x onerror=alert(1)>"}]})
    html = client.get("/inicio").text
    assert "<img src=x" not in html and "</script><img" not in html


def test_infos_contabeis_gravam_e_validam(client):
    itens = [{"rotulo": "CNPJ", "valor": "12.345.678/0001-90"}, {"rotulo": "Banco", "valor": "Itaú"}]
    assert client.put("/api/inicio/infos", json={"versao": 0, "itens": itens}).json() == {"ok": True, "versao": 1}
    assert "12.345.678/0001-90" in client.get("/inicio").text
    assert client.put("/api/inicio/infos", json={"versao": 0, "itens": itens}).status_code == 409
    assert client.put("/api/inicio/infos", json={"versao": 1, "itens": [{"rotulo": "x" * 81, "valor": ""}]}).status_code == 422
    assert client.put("/api/inicio/infos", json={"versao": 1, "itens": [{"rotulo": "a", "valor": ""}] * 61}).status_code == 422


def test_gravar_painel_exige_login(client, monkeypatch):
    monkeypatch.setenv("FROTA_SENHA", "s3gredo")
    r = client.put("/api/inicio/anotacoes", json={"versao": 0, "blocos": []})
    assert r.status_code == 401
    assert client.put("/api/inicio/infos", json={"versao": 0, "itens": []}).status_code == 401


def test_arquivos_estaticos_tem_versao_na_url_e_sao_revalidados(client):
    html = client.get("/inicio").text
    for arq in ("app.css", "app.js", "icones.svg"):
        assert re.search(rf"/static/{re.escape(arq)}\?v=\d+", html), arq
    assert client.get("/static/app.css").headers["cache-control"] == "no-cache"
    assert "?v=" in client.get("/login").text  # a tela de entrada também


def test_so_montserrat_sem_fonte_monoespacada():
    css = (WEB / "static" / "app.css").read_text()
    assert "Plex" not in css and "monospace" not in css and "font-mono" not in css
    assert not list((WEB / "static" / "fonts").glob("ibm-plex*"))


def test_listas_e_datas_usam_o_seletor_do_app(client):
    html = client.get("/design").text
    assert '<select aria-label="Status">' in html and 'type="date"' in html  # o JS troca pelos do app
    js = (WEB / "static" / "app.js").read_text()
    assert "sel-lista" in js and "cal-dias" in js


def test_atributo_hidden_vence_o_estilo_dos_componentes():
    # sem isso o aviso de conflito (class="msg" + hidden) aparece sempre
    assert "[hidden]{display:none!important}" in (WEB / "static" / "app.css").read_text()
