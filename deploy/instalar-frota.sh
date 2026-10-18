#!/bin/bash
# Instala o Frota na VPS, ao lado do CRM e sem tocar nele.
#   sudo bash instalar-frota.sh            -> instala/atualiza o serviço (porta 8001, só 127.0.0.1)
# Não mexe no Caddy. Para publicar no domínio, veja deploy/LEIA-ME.md (passo 3).
set -euo pipefail

REPO="${FROTA_REPO:-git@github-frota:arthurkuster-m1/gestao-de-frota.git}"
BRANCH="${FROTA_BRANCH:-claude/fleet-management-software-rf1gki}"
DIR=/opt/frota
DADOS=/var/lib/frota
PORTA=8001

[ "$(id -u)" = 0 ] || { echo "Rode com sudo."; exit 1; }

# 0. Python 3.12+ e o módulo venv (sem eles a instalação morre no meio).
PY=$(command -v python3.12 || command -v python3.13 || command -v python3 || true)
if [ -z "$PY" ] || ! "$PY" -c 'import sys; sys.exit(sys.version_info < (3, 12))' 2>/dev/null; then
  echo "Precisa de Python 3.12 ou mais novo (atual: $("${PY:-python3}" --version 2>&1))."
  echo "No Ubuntu/Debian:  sudo apt update && sudo apt install -y python3.12 python3.12-venv"; exit 1
fi
"$PY" -c 'import venv, ensurepip' 2>/dev/null || { echo "Falta o venv. Rode:  sudo apt install -y ${PY##*/}-venv"; exit 1; }

# 1. A porta precisa estar livre (não podemos atropelar nada do CRM).
if ss -ltn "sport = :$PORTA" | grep -q LISTEN && ! systemctl is-active --quiet frota; then
  echo "A porta $PORTA já está em uso por outro programa. Nada foi alterado."; exit 1
fi

# 2. Chave de leitura do repositório do Frota (separada da do CRM).
if [ ! -f /root/.ssh/frota_github_deploy ]; then
  ssh-keygen -t ed25519 -N "" -f /root/.ssh/frota_github_deploy -C "frota-vps" >/dev/null
  cat >> /root/.ssh/config <<CFG

Host github-frota
  HostName github.com
  User git
  IdentityFile /root/.ssh/frota_github_deploy
  IdentitiesOnly yes
CFG
  chmod 600 /root/.ssh/config
  echo; echo "PASSO MANUAL: no GitHub, repositório gestao-de-frota > Settings > Deploy keys > Add deploy key"
  echo "(deixe SEM permissão de escrita) e cole esta chave. Depois rode este script de novo:"; echo
  cat /root/.ssh/frota_github_deploy.pub; exit 0
fi

# 3. Usuário próprio, código e dados em pastas separadas.
id frota >/dev/null 2>&1 || useradd --system --home "$DADOS" --shell /usr/sbin/nologin frota
mkdir -p "$DADOS" && chown frota:frota "$DADOS" && chmod 700 "$DADOS"
GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new"; export GIT_SSH_COMMAND
if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" reset -q --hard "origin/$BRANCH"
else git clone -q --branch "$BRANCH" "$REPO" "$DIR"; fi
[ -d "$DIR/.venv" ] || "$PY" -m venv "$DIR/.venv"
"$DIR/.venv/bin/pip" install -q --upgrade pip && "$DIR/.venv/bin/pip" install -q -e "$DIR"

# 4. Configuração (senha e segredo gerados uma única vez).
if [ ! -f /etc/frota.env ]; then
  SENHA=$(python3 -c "import secrets;print(secrets.token_urlsafe(12))")
  umask 077
  cat > /etc/frota.env <<ENV
FROTA_DATA_DIR=$DADOS
FROTA_SENHA=$SENHA
FROTA_SEGREDO=$(python3 -c "import secrets;print(secrets.token_hex(32))")
FROTA_COOKIE_SEGURO=true
ENV
  echo "SENHA DE ACESSO (anote, não será mostrada de novo): $SENHA"
fi

# 5. Serviço, atualização automática e backup.
cp "$DIR/deploy/frota.service" /etc/systemd/system/
for u in frota-atualizar frota-backup; do cp "$DIR/deploy/$u.service" "$DIR/deploy/$u.timer" /etc/systemd/system/; done
install -m 755 "$DIR/deploy/frota-atualizar.sh" /usr/local/bin/frota-atualizar.sh
install -m 755 "$DIR/deploy/frota-backup.sh" /usr/local/bin/frota-backup.sh
systemctl daemon-reload
systemctl enable --now frota frota-atualizar.timer frota-backup.timer
sleep 3
curl -fsS "http://127.0.0.1:$PORTA/saude" && echo " <- Frota no ar em 127.0.0.1:$PORTA"
