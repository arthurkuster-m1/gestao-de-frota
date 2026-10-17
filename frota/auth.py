"""Senha única de acesso (você é o único usuário).

Só entra em ação quando FROTA_SENHA está definida: no PC local fica sem login,
na VPS o instalador sempre define uma.
"""

import hmac
import time

from fastapi import Request
from fastapi.responses import HTMLResponse, RedirectResponse

from .config import get_settings

ABERTAS = ("/login", "/static/", "/saude")
MAX_FALHAS, JANELA = 5, 900  # 5 erros em 15 min bloqueiam aquele IP
_falhas: dict[str, list[float]] = {}


def _ip(request: Request) -> str:
    # Atrás do proxy local o IP real vem no cabeçalho; o proxy é de confiança (127.0.0.1).
    enc = request.headers.get("x-forwarded-for", "")
    return enc.split(",")[0].strip() or (request.client.host if request.client else "?")


def _bloqueado(ip: str) -> bool:
    agora = time.time()
    recentes = [t for t in _falhas.get(ip, []) if agora - t < JANELA]
    _falhas[ip] = recentes
    return len(recentes) >= MAX_FALHAS


def senha_confere(informada: str) -> bool:
    return hmac.compare_digest(informada.encode(), get_settings().senha.encode())


def registrar_falha(request: Request) -> None:
    _falhas.setdefault(_ip(request), []).append(time.time())


def esta_bloqueado(request: Request) -> bool:
    return _bloqueado(_ip(request))


async def exigir_login(request: Request, call_next):
    if not get_settings().senha:
        return await call_next(request)
    caminho = request.url.path
    if caminho.startswith(ABERTAS) or request.session.get("ok"):
        return await call_next(request)
    if request.method == "GET":
        return RedirectResponse("/login", status_code=303)
    return HTMLResponse("Faça login.", status_code=401)
