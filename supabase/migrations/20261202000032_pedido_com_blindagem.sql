-- manifest: o pedido de modelo do evento passa a poder pedir blindagem (sim / não; vazio = tanto faz). Idempotente.
alter table public.evento_modelos_desejados add column if not exists blindado boolean;
