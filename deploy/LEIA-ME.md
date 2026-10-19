# Frota na VPS do M1 (ao lado do CRM, sem tocar nele)

O Frota roda como um serviço à parte: usuário próprio (`frota`), código em `/opt/frota`, dados em
`/var/lib/frota`, porta `127.0.0.1:8001` (só a própria VPS enxerga), no máximo 400 MB de memória e
prioridade baixa. O CRM (porta 3001, `m1-app`, Caddy, WhatsApp) não é alterado em nenhum passo 1–2.

## 1. Chave de leitura (uma vez)
Na VPS: `sudo bash deploy/instalar-frota.sh` (ou baixe o arquivo do GitHub).
Na primeira vez ele só gera a chave e mostra a parte pública. Cadastre em
GitHub → `gestao-de-frota` → Settings → Deploy keys (sem escrita).

## 2. Instalar
Rode o mesmo comando de novo. Ele clona, cria o ambiente Python, grava `/etc/frota.env` com uma
**senha gerada** (mostrada uma única vez), liga o serviço, a atualização automática (a cada 2 min,
com volta ao commit anterior se não subir) e o backup diário (14 dias, em `/var/backups/frota`).

Teste na própria VPS: `curl http://127.0.0.1:8001/saude` → `{"ok":true}`.

## 3. Publicar para abrir no celular (único passo que encosta no Caddy)
1. No DNS do domínio, crie um registro **A** `frota` apontando para o mesmo IP do `www`.
2. Acrescente ao fim de `/etc/caddy/Caddyfile`:
   ```
   frota.infra-assessoria-m1.cloud {
       reverse_proxy 127.0.0.1:8001
   }
   ```
3. Valide antes de aplicar, com cópia de segurança:
   ```bash
   sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.antes-frota
   sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
   ```
   `reload` não derruba conexões do CRM. Se o `validate` reclamar, não recarregue: volte a cópia.

Alternativa que não mexe no Caddy: Cloudflare Tunnel apontando `frota.…` para `http://127.0.0.1:8001`.

## Como você vê as mudanças
Push na `main` → em até 2 minutos a VPS atualiza e reinicia só o Frota → você atualiza a página no celular.
O banco fica fora do repositório, então atualizar nunca apaga seus dados. Quando o commit traz migration
nova, o atualizador guarda antes uma cópia do banco em `/var/backups/frota/antes-<commit>.sqlite`; se o
Frota não subir, ele volta o código e essa cópia juntos. Os scripts e serviços de `deploy/` também se
atualizam sozinhos.

## VPS instalada antes da `main` (uma vez só)
Quem instalou quando o Frota seguia a branch `claude/fleet-management-software-rf1gki` continua nela.
Para passar a seguir a `main`, rode de novo: `sudo bash /opt/frota/deploy/instalar-frota.sh`.
Senha, dados e backups ficam como estão.

## Parar / remover (CRM intacto)
`sudo systemctl disable --now frota frota-atualizar.timer frota-backup.timer`
