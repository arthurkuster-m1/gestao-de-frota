"""O menu lateral. Uma tela nova só existe de verdade depois de entrar aqui (e no teste de menu)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Item:
    rotulo: str
    href: str
    icone: str
    # Caminhos que deixam o item aceso (ex.: /comodatos/lote acende "Contratos de Comodato").
    prefixos: tuple[str, ...] = ()
    breve: bool = False  # ainda é só a estrutura crua, com o texto "Em breve"


GRUPOS: list[tuple[str, list[Item]]] = [
    ("", [
        Item("Início", "/inicio", "house", ("/inicio",)),
        Item("Veículos", "/veiculos", "car", ("/veiculos",)),
        Item("Eventos", "/eventos", "calendar-dots", ("/eventos",), breve=True),
        Item("Contratos de Comodato", "/comodatos", "file-doc", ("/comodatos", "/modelos")),
    ]),
    ("Acompanhamento", [
        Item("Sinistros e Manutenções", "/sinistros", "wrench", ("/sinistros",), breve=True),
        Item("Multas", "/multas", "traffic-signal", ("/multas",), breve=True),
        Item("Devoluções", "/devolucoes", "arrow-u-up-left", ("/devolucoes",), breve=True),
    ]),
    ("Financeiro", [
        Item("Faturamentos", "/faturamentos", "receipt", ("/faturamentos",), breve=True),
        Item("Dashboard financeiro", "/financeiro", "chart-line-up", ("/financeiro",), breve=True),
    ]),
    ("Cadastros", [
        Item("Clientes", "/clientes", "users", ("/clientes",)),
    ]),
    ("Sistema", [
        Item("Design system", "/design", "palette", ("/design",)),
    ]),
]


def ativo(item: Item, caminho: str) -> bool:
    return any(caminho == p or caminho.startswith(p + "/") for p in item.prefixos)
