from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from urllib.parse import quote

from fastapi import Depends, FastAPI, Form, Request, UploadFile
from fastapi.responses import RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.orm import Session

from starlette.middleware.sessions import SessionMiddleware

from . import auth
from . import db as dbmod
from .config import get_settings
from .db import get_session
from .models import Cliente, Comodato, ModeloDocumento, StatusVeiculo, Veiculo
from .services import colagem, comodatos, documentos, inicio as svc_inicio
from .web import menu as menu_mod
from .services.comodatos import ErroDeNegocio

WEB = Path(__file__).parent / "web"
templates = Jinja2Templates(directory=str(WEB / "templates"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    cfg = get_settings()
    if cfg.senha and cfg.segredo == "troque-me":
        # Com o segredo padrão qualquer um forjaria o cookie de login.
        raise RuntimeError("Defina FROTA_SEGREDO (valor aleatório) junto com FROTA_SENHA.")
    if dbmod.engine is None:
        dbmod.init_db()
    yield


app = FastAPI(title="Frota", lifespan=lifespan)
# Ordem importa: o último adicionado é o mais externo. A sessão precisa envolver o porteiro.
app.middleware("http")(auth.exigir_login)
app.add_middleware(SessionMiddleware, secret_key=get_settings().segredo, max_age=60 * 60 * 24 * 30,
                   same_site="lax", https_only=get_settings().cookie_seguro, session_cookie="frota")
app.mount("/static", StaticFiles(directory=str(WEB / "static")), name="static")


def _menu(caminho: str):
    return [(g, [{"rotulo": i.rotulo, "href": i.href, "icone": i.icone, "breve": i.breve,
                  "on": menu_mod.ativo(i, caminho)} for i in itens]) for g, itens in menu_mod.GRUPOS]


def render(request: Request, nome: str, **ctx):
    ctx.setdefault("msg", request.query_params.get("msg"))
    ctx["menu"] = _menu(request.url.path)
    ctx["com_login"] = bool(get_settings().senha)
    return templates.TemplateResponse(request, nome, ctx)


def voltar(url: str, msg: str | None = None) -> RedirectResponse:
    return RedirectResponse(url + (f"?msg={quote(msg)}" if msg else ""), status_code=303)


ROTULOS_VEICULO = [("disponivel", "Disponível"), ("em_comodato", "Em comodato"), ("manutencao", "Manutenção"),
                   ("sinistrado", "Sinistrado"), ("baixado", "Baixado")]


@app.get("/saude")
def saude():
    return {"ok": True}


@app.get("/login")
def login_form(request: Request):
    return render(request, "login.html", erro=None)


@app.post("/login")
def login(request: Request, senha: str = Form("")):
    if auth.esta_bloqueado(request):
        return render(request, "login.html", erro="Muitas tentativas. Tente de novo em 15 minutos.")
    if get_settings().senha and auth.senha_confere(senha):
        request.session["ok"] = True
        return RedirectResponse("/", status_code=303)
    auth.registrar_falha(request)
    return render(request, "login.html", erro="Senha incorreta.")


@app.post("/sair")
def sair(request: Request):
    request.session.clear()
    return RedirectResponse("/login", status_code=303)


@app.get("/")
def raiz():
    return RedirectResponse("/inicio")


@app.get("/inicio")
def inicio(request: Request, dia: str = "", db: Session = Depends(get_session)):
    try:
        escolhido = date.fromisoformat(dia) if dia else None
    except ValueError:
        escolhido = None
    return render(request, "inicio.html", i=svc_inicio.montar(db, escolhido))


# Telas que ainda são só a estrutura: o que vai existir em cada uma (plano em docs/mapa-funcionalidades.md).
EM_BREVE = {
    "eventos": ("Eventos", "calendar-dots", "Tabela estilo Notion com todos os eventos e usos da frota, com visualização em linha do tempo.", [
        "Tipo do evento (Comodato > 1 mês, Evento ou gravação, Corrida, Agrifeira, Experience, Lançamentos…).",
        "Saídas de veículos ligadas a cada evento, com datas de envio, início e final.",
        "Visualizações salvas: tabela, linha do tempo, calendário e quadro por situação.",
    ]),
    "sinistros": ("Sinistros e Manutenções", "wrench", "Registro de sinistros e manutenções por veículo, com seguro e custos.", [
        "Sinistros ligados ao veículo e ao comodato vigente na data.",
        "Manutenções e revisões com custo e prazo.",
        "Apólices e acionamento do seguro.",
    ]),
    "multas": ("Multas", "traffic-signal", "Cadastro de multas com a pesquisa automática de quem estava com o carro.", [
        "Placa e data/hora da infração cruzadas com o comodato vigente.",
        "Contato do responsável já levantado, com o prazo de indicação do condutor.",
        "Importação por planilha.",
    ]),
    "devolucoes": ("Devoluções", "arrow-u-up-left", "Acompanhamento do retorno dos veículos e da devolução à montadora.", [
        "Retornos solicitados, em trânsito e concluídos.",
        "Checklist de devolução e fotos.",
        "Datas de devolução e liberação do veículo.",
    ]),
    "faturamentos": ("Faturamentos", "receipt", "Notas fiscais e valores cobrados por saída de veículo.", [
        "Nota fiscal por saída, com aprovação.",
        "Valores de transporte de ida, retorno e apoio.",
        "Marcação de faturado por veículo.",
    ]),
    "financeiro": ("Dashboard financeiro", "chart-line-up", "Visão dos custos completos da frota.", [
        "Custo total por veículo, por evento e por transportadora.",
        "Sinistros, manutenções, multas e transporte somados.",
        "Evolução mensal.",
    ]),
}


def _em_breve(chave: str):
    titulo, icone_nome, resumo, itens = EM_BREVE[chave]

    def pagina(request: Request):
        return render(request, "em_breve.html", titulo=titulo, icone_pagina=icone_nome,
                      resumo_pagina=resumo, itens=itens)
    return pagina


for _chave in EM_BREVE:
    app.get(f"/{_chave}", name=f"em_breve_{_chave}")(_em_breve(_chave))


@app.get("/design")
def design(request: Request):
    return render(request, "design.html", titulo="Design system")


# ---------- veículos ----------
@app.get("/veiculos")
def veiculos(request: Request, status: str | None = None, q: str = "", db: Session = Depends(get_session)):
    stmt = select(Veiculo).order_by(Veiculo.placa)
    if status:
        stmt = stmt.where(Veiculo.status == status)
    if q:
        like = f"%{q.upper()}%"
        stmt = stmt.where(Veiculo.placa.like(like) | Veiculo.modelo.ilike(f"%{q}%"))
    todos = db.scalars(select(Veiculo)).all()
    contagem = {s.value: 0 for s in StatusVeiculo}
    for v in todos:
        contagem[v.status] += 1
    return render(request, "veiculos.html", veiculos=db.scalars(stmt).all(), contagem=contagem,
                  status_atual=status, q=q, total=len(todos), statuses=ROTULOS_VEICULO)


@app.post("/veiculos")
def veiculo_novo(placa: str = Form(...), marca: str = Form(""), modelo: str = Form(""),
                 chassi: str = Form(""), renavam: str = Form(""), cor: str = Form(""),
                 ano_fabricacao: int | None = Form(None), ano_modelo: int | None = Form(None),
                 db: Session = Depends(get_session)):
    placa = colagem.normalizar_placa(placa)
    if db.scalar(select(Veiculo).where(Veiculo.placa == placa)):
        return voltar("/veiculos", f"Placa {placa} já cadastrada")
    db.add(Veiculo(placa=placa, marca=marca or None, modelo=modelo or None, chassi=chassi or None,
                   renavam=renavam or None, cor=cor or None, ano_fabricacao=ano_fabricacao,
                   ano_modelo=ano_modelo))
    db.commit()
    return voltar("/veiculos", f"Veículo {placa} cadastrado")


@app.get("/veiculos/{vid}")
def veiculo(request: Request, vid: str, db: Session = Depends(get_session)):
    v = db.get(Veiculo, vid)
    if not v:
        return Response("Veículo não encontrado", status_code=404)
    return render(request, "veiculo.html", v=v, statuses=ROTULOS_VEICULO)


@app.post("/veiculos/{vid}/status")
def veiculo_status(vid: str, status: str = Form(...), observacao: str = Form(""),
                   db: Session = Depends(get_session)):
    v = db.get(Veiculo, vid)
    try:
        comodatos.mudar_status_veiculo(db, v, status, observacao=observacao or None)
    except ErroDeNegocio as e:
        return voltar(f"/veiculos/{vid}", str(e))
    db.commit()
    return voltar(f"/veiculos/{vid}", "Status atualizado")


# ---------- clientes ----------
@app.get("/clientes")
def clientes(request: Request, db: Session = Depends(get_session)):
    return render(request, "clientes.html", clientes=db.scalars(select(Cliente).order_by(Cliente.nome)).all())


@app.post("/clientes")
def cliente_novo(nome: str = Form(...), documento: str = Form(""), email: str = Form(""),
                 telefone: str = Form(""), endereco: str = Form(""), db: Session = Depends(get_session)):
    doc = colagem.so_digitos(documento) or None
    if doc and db.scalar(select(Cliente).where(Cliente.documento == doc)):
        return voltar("/clientes", "Documento já cadastrado")
    db.add(Cliente(nome=nome, documento=doc, email=email or None, telefone=telefone or None,
                   endereco=endereco or None))
    db.commit()
    return voltar("/clientes", "Cliente cadastrado")


# ---------- modelos Word ----------
@app.get("/modelos")
def modelos(request: Request, db: Session = Depends(get_session)):
    campos_oficiais = sorted(_campos_oficiais())
    return render(request, "modelos.html", modelos=db.scalars(select(ModeloDocumento)).all(),
                  campos_oficiais=campos_oficiais, msg=request.query_params.get("msg"))


def _campos_oficiais() -> list[str]:
    from datetime import date as _d
    from .models import Cliente as C, Comodato as M, Veiculo as V
    fake = M(numero=1, data_saida=_d.today(), cliente=C(nome="x"), veiculo=V(placa="X"))
    return list(documentos.contexto_do_comodato(fake).keys())


@app.post("/modelos")
async def modelo_novo(nome: str = Form(...), arquivo: UploadFile = Form(...),
                      db: Session = Depends(get_session)):
    try:
        m = documentos.salvar_modelo(db, nome, await arquivo.read())
    except ValueError as e:
        return voltar("/modelos", str(e))
    except Exception:
        db.rollback()
        return voltar("/modelos", f"Já existe um modelo chamado “{nome}”")
    desconhecidos = set(m.campos) - set(_campos_oficiais())
    aviso = f" (campos fora do padrão: {', '.join(sorted(desconhecidos))})" if desconhecidos else ""
    return voltar("/modelos", f"Modelo “{nome}” salvo com {len(m.campos)} campos{aviso}")


# ---------- comodatos ----------
@app.get("/comodatos")
def comodatos_lista(request: Request, db: Session = Depends(get_session)):
    lista = db.scalars(select(Comodato).order_by(Comodato.numero.desc())).all()
    return render(request, "comodatos.html", comodatos=lista,
                  modelos=db.scalars(select(ModeloDocumento)).all(), msg=request.query_params.get("msg"))


@app.get("/comodatos/lote")
def lote_form(request: Request):
    return render(request, "lote.html", texto="", linhas=None, colunas=[], criados=None,
                  aceitas=colagem.APELIDOS)


@app.post("/comodatos/lote")
def lote_post(request: Request, texto: str = Form(""), confirmar: str = Form(""),
              db: Session = Depends(get_session)):
    colunas, linhas = colagem.ler_tabela(texto)
    if not confirmar:
        comodatos.validar_lote(db, linhas)
        return render(request, "lote.html", texto=texto, linhas=linhas, colunas=colunas, criados=None,
                      aceitas=colagem.APELIDOS)
    criados = comodatos.criar_lote(db, linhas)
    return render(request, "lote.html", texto="", linhas=linhas, colunas=colunas, criados=criados,
                  modelos=db.scalars(select(ModeloDocumento)).all(), aceitas=colagem.APELIDOS)


@app.get("/comodatos/{cid}/documento/{mid}")
def baixar_documento(cid: str, mid: str, db: Session = Depends(get_session)):
    com, modelo = db.get(Comodato, cid), db.get(ModeloDocumento, mid)
    if not com or not modelo:
        return Response("Não encontrado", status_code=404)
    try:
        conteudo = documentos.gerar_docx(modelo, com)
    except Exception as e:
        return Response(f"Não foi possível gerar: {e}", status_code=422)
    if com.status == "rascunho":
        com.status = "gerado"
        db.commit()
    return Response(conteudo, media_type=_DOCX,
                    headers={"Content-Disposition": f'attachment; filename="{documentos.nome_do_arquivo(modelo, com)}"'})


_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@app.get("/comodatos/zip/{mid}")
def baixar_zip(mid: str, ids: str, db: Session = Depends(get_session)):
    modelo = db.get(ModeloDocumento, mid)
    coms = [c for c in (db.get(Comodato, i) for i in ids.split(",")) if c]
    if not modelo or not coms:
        return Response("Não encontrado", status_code=404)
    try:
        conteudo = documentos.gerar_zip(modelo, coms)
    except Exception as e:
        return Response(f"Não foi possível gerar: {e}", status_code=422)
    for c in coms:
        if c.status == "rascunho":
            c.status = "gerado"
    db.commit()
    return Response(conteudo, media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="comodatos_{date.today():%Y%m%d}.zip"'})


@app.post("/comodatos/{cid}/encerrar")
def encerrar(cid: str, db: Session = Depends(get_session)):
    com = db.get(Comodato, cid)
    try:
        comodatos.encerrar_comodato(db, com)
    except ErroDeNegocio as e:
        return voltar("/comodatos", str(e))
    db.commit()
    return voltar("/comodatos", f"Comodato #{com.numero} encerrado; {com.veiculo.placa} disponível")
