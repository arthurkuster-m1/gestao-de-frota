#!/bin/bash
# Cópia diária consistente do banco (sqlite .backup) + modelos Word. Guarda 14 dias.
set -euo pipefail
D=/var/lib/frota; B=/var/backups/frota; mkdir -p "$B"
hoje=$(date +%F)
python3 - "$D/frota.sqlite" "$B/frota-$hoje.sqlite" <<'PY'
import sqlite3, sys
src = sqlite3.connect(sys.argv[1]); dst = sqlite3.connect(sys.argv[2]); src.backup(dst); dst.close(); src.close()
PY
[ -d "$D/arquivos" ] && tar -czf "$B/arquivos-$hoje.tgz" -C "$D" arquivos
chmod 600 "$B"/*; find "$B" -type f -mtime +14 -delete
