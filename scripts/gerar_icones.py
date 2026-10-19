"""Gera frota/web/static/icones.svg (sprite) a partir do pacote @phosphor-icons/core.

Uso:  python scripts/gerar_icones.py CAMINHO/DO/PACOTE/assets
Cada ícone vira dois <symbol>: `i-<nome>` (regular) e `i-<nome>-fill` (preenchido, item ativo do menu).
Para um ícone novo, acrescente o nome em ICONES e rode de novo; o teste de ícones avisa se algo falta.
"""
import re
import sys
from pathlib import Path

ICONES = [
    "house", "car", "calendar-dots", "file-doc", "wrench", "traffic-signal", "receipt", "arrow-u-up-left",
    "chart-line-up", "users", "palette", "moon", "sun", "sign-out", "list", "x", "plus", "magnifying-glass",
    "download-simple", "info", "check-circle", "warning", "x-circle", "calendar-blank", "caret-left",
    "caret-right", "clipboard-text", "stack", "check-square", "bell", "truck", "clock", "file-arrow-up",
    "paper-plane-tilt", "hourglass", "arrow-right", "list-checks",
]

raiz = Path(sys.argv[1])
saida = Path(__file__).resolve().parent.parent / "frota/web/static/icones.svg"
simbolos = []
for nome in ICONES:
    for estilo, sufixo in (("regular", ""), ("fill", "-fill")):
        arq = raiz / estilo / (f"{nome}.svg" if estilo == "regular" else f"{nome}-fill.svg")
        if not arq.exists():
            sys.exit(f"ícone ausente no pacote: {arq}")
        interno = re.search(r"<svg[^>]*>(.*)</svg>", arq.read_text(), re.S).group(1).strip()
        simbolos.append(f'<symbol id="i-{nome}{sufixo}" viewBox="0 0 256 256" fill="currentColor">{interno}</symbol>')
saida.write_text('<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n' + "\n".join(simbolos) + "\n</svg>\n")
print(f"{len(ICONES) * 2} símbolos em {saida}")
