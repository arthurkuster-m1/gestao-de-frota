-- manifest: Dados do evento em seções: contato da origem e do retorno, endereço de retorno do evento e custos extras. Idempotente.
-- (Contato do evento continua em eventos.contato.)
alter table public.eventos add column if not exists contato_origem text check (contato_origem is null or length(btrim(contato_origem)) between 1 and 200);
alter table public.eventos add column if not exists contato_retorno text check (contato_retorno is null or length(btrim(contato_retorno)) between 1 and 200);
alter table public.eventos add column if not exists endereco_retorno text check (endereco_retorno is null or length(btrim(endereco_retorno)) between 1 and 300);
alter table public.eventos add column if not exists custos_extras numeric(12, 2) check (custos_extras is null or custos_extras >= 0);
