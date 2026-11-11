-- manifest: (1) contato lembrado por endereço (a origem Av. Goiás 1805 sempre com o mesmo contato; o local de um evento recorrente também);
-- (2) título (nome do local) também na origem principal do evento. Idempotente.
alter table public.eventos add column if not exists origem_rotulo text check (origem_rotulo is null or length(btrim(origem_rotulo)) between 1 and 120);

create table if not exists public.contatos_de_endereco (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  endereco text not null check (length(btrim(endereco)) between 1 and 400),
  contato text not null check (length(btrim(contato)) between 1 and 200),
  updated_at timestamptz not null default now()
);
create unique index if not exists contatos_de_endereco_uidx on public.contatos_de_endereco (workspace_id, lower(btrim(endereco)));
drop trigger if exists contatos_de_endereco_touch on public.contatos_de_endereco;
create trigger contatos_de_endereco_touch before update on public.contatos_de_endereco for each row execute function public.fn_touch_updated_at();
alter table public.contatos_de_endereco enable row level security;
drop policy if exists tenant_isolation_contatos_de_endereco_all on public.contatos_de_endereco;
create policy tenant_isolation_contatos_de_endereco_all on public.contatos_de_endereco for all to authenticated
  using (workspace_id in (select public.fn_my_workspaces())) with check (workspace_id in (select public.fn_my_workspaces()));
revoke all on public.contatos_de_endereco from anon, authenticated;
grant select, insert, update, delete on public.contatos_de_endereco to authenticated;
