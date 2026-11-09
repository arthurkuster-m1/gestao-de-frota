-- Contato do responsável do evento (cadastro rápido: o evento nasce incompleto e vai sendo preenchido). Idempotente.
alter table public.eventos add column if not exists contato text check (contato is null or length(btrim(contato)) between 1 and 200);
