-- manifest: departamentos gerenciáveis do veículo (Marketing é o padrão e não se apaga). O app traz os de sempre; esta tabela guarda os criados, renomeados ou apagados. Idempotente.
create table if not exists public.departamentos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 60),
  posicao int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists departamentos_nome_uidx on public.departamentos (workspace_id, lower(btrim(nome)));
alter table public.departamentos enable row level security;
drop policy if exists tenant_isolation_departamentos_all on public.departamentos;
create policy tenant_isolation_departamentos_all on public.departamentos for all to authenticated
  using (workspace_id in (select public.fn_my_workspaces())) with check (workspace_id in (select public.fn_my_workspaces()));
revoke all on public.departamentos from anon, authenticated;
grant select, insert, update, delete on public.departamentos to authenticated;
