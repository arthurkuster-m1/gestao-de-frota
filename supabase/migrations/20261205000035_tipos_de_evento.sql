-- manifest: tipos de evento gerenciáveis (nome + "os carros não voltam"). O app traz os tipos de sempre; esta tabela guarda os que o espaço criou, renomeou ou ajustou. Idempotente.
create table if not exists public.tipos_de_evento (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 80),
  sem_retorno boolean not null default false,
  posicao int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists tipos_de_evento_nome_uidx on public.tipos_de_evento (workspace_id, lower(btrim(nome)));
alter table public.tipos_de_evento enable row level security;
drop policy if exists tenant_isolation_tipos_de_evento_all on public.tipos_de_evento;
create policy tenant_isolation_tipos_de_evento_all on public.tipos_de_evento for all to authenticated
  using (workspace_id in (select public.fn_my_workspaces())) with check (workspace_id in (select public.fn_my_workspaces()));
revoke all on public.tipos_de_evento from anon, authenticated;
grant select, insert, update, delete on public.tipos_de_evento to authenticated;
