-- O cliente do evento (o evento manda: contratos e transportes partem dele). Apagar o cliente solta o evento. Idempotente.
alter table public.eventos add column if not exists cliente_id uuid;
alter table public.eventos drop constraint if exists eventos_cliente_fk;
alter table public.eventos add constraint eventos_cliente_fk
  foreign key (cliente_id, workspace_id) references public.clientes (id, workspace_id) on delete set null (cliente_id);
create index if not exists eventos_cliente_idx on public.eventos (cliente_id) where cliente_id is not null;
