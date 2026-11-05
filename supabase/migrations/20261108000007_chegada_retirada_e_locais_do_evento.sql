-- Chegada e retirada dos carros (para a linha do tempo desenhar logística + evento) e LOCAIS do evento.
--  * `evento_veiculos.chegada` / `retirada`: o dia em que o carro chega ao evento e o dia em que sai. O período da reserva
--    (reserva_inicio..reserva_fim) já inclui a logística; entre reserva_inicio e a chegada é o prazo de ida,
--    e entre a retirada e reserva_fim é o prazo de volta. Opcionais: sem elas a reserva é um bloco só.
--  * `evento_locais`: os endereços do evento, DIGITADOS em cada evento (não é cadastro reaproveitado), quantos forem necessários.
-- Idempotente. Contato (nome e telefone) de cada local entra depois, criptografado, junto com os transportes.

alter table public.evento_veiculos add column if not exists chegada date;
alter table public.evento_veiculos add column if not exists retirada date;
alter table public.evento_veiculos drop constraint if exists evento_veiculos_janela_check;
alter table public.evento_veiculos add constraint evento_veiculos_janela_check check (
  (chegada is null or (chegada >= reserva_inicio and chegada <= reserva_fim))
  and (retirada is null or (retirada >= reserva_inicio and retirada <= reserva_fim))
  and (chegada is null or retirada is null or chegada <= retirada));

create table if not exists public.evento_locais (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  evento_id uuid not null,
  rotulo text check (rotulo is null or length(btrim(rotulo)) between 1 and 80),     -- ex.: "Estande principal"
  endereco text not null check (length(btrim(endereco)) between 1 and 300),
  cidade text,
  estado text check (estado is null or estado ~ '^[A-Z]{2}$'),
  posicao int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (evento_id, workspace_id) references public.eventos (id, workspace_id) on delete cascade
);
create index if not exists evento_locais_evento_idx on public.evento_locais (evento_id, posicao);

drop trigger if exists evento_locais_touch on public.evento_locais;
create trigger evento_locais_touch before update on public.evento_locais for each row execute function public.fn_touch_updated_at();

alter table public.evento_locais enable row level security;
drop policy if exists tenant_isolation_evento_locais_all on public.evento_locais;
create policy tenant_isolation_evento_locais_all on public.evento_locais for all to authenticated
  using (workspace_id in (select public.fn_my_workspaces()))
  with check (workspace_id in (select public.fn_my_workspaces()));
revoke all on public.evento_locais from anon, authenticated;
grant select, insert, update, delete on public.evento_locais to authenticated;
