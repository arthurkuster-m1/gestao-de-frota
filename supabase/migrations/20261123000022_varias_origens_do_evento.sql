-- manifest: o evento pode ter VÁRIAS origens (além da principal, que fica em eventos.origem) e vários locais: evento_locais ganha "tipo".
-- 'local' = endereço do evento (como era); 'origem' = origem extra. Idempotente.
alter table public.evento_locais add column if not exists tipo text not null default 'local';
alter table public.evento_locais drop constraint if exists evento_locais_tipo_check;
alter table public.evento_locais add constraint evento_locais_tipo_check check (tipo in ('local', 'origem'));
