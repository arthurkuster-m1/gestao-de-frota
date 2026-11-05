-- Núcleo da Frota: espaço de trabalho (workspace), membros e ajudantes de RLS.
-- Mesmo padrão do familia-kuster (household -> workspace): cada linha de cada módulo carrega workspace_id,
-- e a RLS libera só quem é membro desse espaço. Idempotente: pode rodar de novo sem duplicar nem quebrar.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
-- Cada usuário pertence a um único espaço (simplifica o default de workspace_id nas tabelas dos módulos).
create unique index if not exists workspace_members_user_uidx on public.workspace_members(user_id);

create or replace function public.fn_my_workspaces()
returns setof uuid language sql stable security definer set search_path = public as $$
  select workspace_id from public.workspace_members where user_id = auth.uid()
$$;

create or replace function public.fn_default_workspace()
returns uuid language sql stable security definer set search_path = public as $$
  select workspace_id from public.workspace_members where user_id = auth.uid() limit 1
$$;

create or replace function public.fn_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- Função em public nasce exposta (PUBLIC e anon): revoga as DUAS origens e libera só quem está logado.
revoke execute on function public.fn_my_workspaces() from public, anon;
revoke execute on function public.fn_default_workspace() from public, anon;
revoke execute on function public.fn_touch_updated_at() from public, anon;
grant execute on function public.fn_my_workspaces() to authenticated;
grant execute on function public.fn_default_workspace() to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces for select to authenticated
  using (id in (select public.fn_my_workspaces()));

drop policy if exists members_select on public.workspace_members;
create policy members_select on public.workspace_members for select to authenticated
  using (workspace_id in (select public.fn_my_workspaces()));

-- Só leitura pelo app. Criar espaço e membros é feito por SQL (seed), nunca pelo navegador.
revoke all on public.workspaces, public.workspace_members from anon, authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;
