-- Endereço de origem do evento (de onde os carros saem; cada carro pode ter a sua, que vale no lugar desta). Idempotente.
alter table public.eventos add column if not exists origem text check (origem is null or length(btrim(origem)) between 1 and 300);
