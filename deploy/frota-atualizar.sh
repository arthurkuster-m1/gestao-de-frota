#!/bin/bash
# Roda a cada 2 min: se há commit novo na branch, atualiza e reinicia só o Frota.
# Se o serviço não subir, volta ao commit anterior (e ao banco de antes, se havia migration nova).
set -euo pipefail
DIR=/opt/frota
BANCO=/var/lib/frota/frota.sqlite
exec 9>/var/lock/frota-atualizar.lock; flock -n 9 || exit 0
BRANCH=$(git -C "$DIR" rev-parse --abbrev-ref HEAD)
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new"
git -C "$DIR" fetch -q origin "$BRANCH" || exit 0
antes=$(git -C "$DIR" rev-parse HEAD); depois=$(git -C "$DIR" rev-parse "origin/$BRANCH")
[ "$antes" = "$depois" ] && exit 0
echo "[frota] $antes -> $depois"

# Migration nova muda o banco ao subir; guarda uma cópia para poder voltar junto com o código.
copia=""
if [ -f "$BANCO" ] && git -C "$DIR" diff --name-only "$antes" "$depois" | grep -q '^frota/migracoes/'; then
  copia="/var/backups/frota/antes-${depois:0:8}.sqlite"; mkdir -p /var/backups/frota
  python3 -c "import sqlite3,sys; s=sqlite3.connect(sys.argv[1]); d=sqlite3.connect(sys.argv[2]); s.backup(d); d.close(); s.close()" "$BANCO" "$copia"
  chmod 600 "$copia"; echo "[frota] cópia do banco antes da migration: $copia"
fi

instalar_extras() {  # scripts e serviços do deploy acompanham o código
  cp "$DIR"/deploy/frota.service "$DIR"/deploy/frota-atualizar.{service,timer} "$DIR"/deploy/frota-backup.{service,timer} /etc/systemd/system/
  install -m 755 "$DIR/deploy/frota-atualizar.sh" /usr/local/bin/frota-atualizar.sh
  install -m 755 "$DIR/deploy/frota-backup.sh" /usr/local/bin/frota-backup.sh
  systemctl daemon-reload
}

git -C "$DIR" reset -q --hard "$depois"
"$DIR/.venv/bin/pip" install -q -e "$DIR"
instalar_extras
systemctl restart frota
for _ in 1 2 3 4 5 6; do sleep 2; curl -fsS http://127.0.0.1:8001/saude >/dev/null 2>&1 && exit 0; done

echo "[frota] não subiu; voltando para $antes"
systemctl stop frota
if [ -n "$copia" ]; then cp "$copia" "$BANCO"; chown frota:frota "$BANCO"; rm -f "$BANCO-wal" "$BANCO-shm"; fi
git -C "$DIR" reset -q --hard "$antes"; "$DIR/.venv/bin/pip" install -q -e "$DIR"; instalar_extras; systemctl start frota
exit 1
