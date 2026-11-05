#!/bin/bash
# Roda a cada 2 min: se há commit novo na branch, atualiza e reinicia só o Frota.
# Se o serviço não subir, volta ao commit anterior.
set -euo pipefail
DIR=/opt/frota
exec 9>/var/lock/frota-atualizar.lock; flock -n 9 || exit 0
BRANCH=$(git -C "$DIR" rev-parse --abbrev-ref HEAD)
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new"
git -C "$DIR" fetch -q origin "$BRANCH" || exit 0
antes=$(git -C "$DIR" rev-parse HEAD); depois=$(git -C "$DIR" rev-parse "origin/$BRANCH")
[ "$antes" = "$depois" ] && exit 0
echo "[frota] $antes -> $depois"
git -C "$DIR" reset -q --hard "$depois"
"$DIR/.venv/bin/pip" install -q -e "$DIR"
systemctl restart frota
for _ in 1 2 3 4 5 6; do sleep 2; curl -fsS http://127.0.0.1:8001/saude >/dev/null 2>&1 && exit 0; done
echo "[frota] não subiu; voltando para $antes"
git -C "$DIR" reset -q --hard "$antes"; "$DIR/.venv/bin/pip" install -q -e "$DIR"; systemctl restart frota
exit 1
