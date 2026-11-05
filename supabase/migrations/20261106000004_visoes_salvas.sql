-- Visualizações salvas das tabelas (as "abas" de Veículos, Eventos…): nome + tipo + configuração
-- (filtros, ordenação, agrupamento, colunas visíveis, ordem, larguras e colunas congeladas).
-- Como no CRM: são do ESPAÇO DE TRABALHO (quem é membro vê e edita as mesmas abas). Idempotente.
-- `config` é validado pelo app (zod); aqui só se barra lixo grande. `tipo` é vocabulário fechado.

create table if not exists public.visoes_salvas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  tela text not null check (tela ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  nome text not null check (length(btrim(nome)) between 1 and 60),
  tipo text not null default 'tabela' check (tipo in ('tabela', 'kanban', 'calendario', 'timeline', 'galeria')),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object' and pg_column_size(config) < 30000),
  posicao numeric not null default 0,
  criado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists visoes_salvas_nome_uidx on public.visoes_salvas (workspace_id, tela, lower(btrim(nome)));
create index if not exists visoes_salvas_tela_idx on public.visoes_salvas (workspace_id, tela, posicao);

drop trigger if exists visoes_salvas_touch on public.visoes_salvas;
create trigger visoes_salvas_touch before update on public.visoes_salvas for each row execute function public.fn_touch_updated_at();

alter table public.visoes_salvas enable row level security;
drop policy if exists tenant_isolation_visoes_salvas_all on public.visoes_salvas;
create policy tenant_isolation_visoes_salvas_all on public.visoes_salvas for all to authenticated
  using (workspace_id in (select public.fn_my_workspaces()))
  with check (workspace_id in (select public.fn_my_workspaces()));

revoke all on public.visoes_salvas from anon, authenticated;
grant select, insert, update, delete on public.visoes_salvas to authenticated;
