-- manifest: Anotações do evento: uma página de planejamento por evento (`evento_anotacoes`), só aparece dentro do evento e não se mistura com as páginas do menu Anotações (`notes_pages`). O conteúdo é o documento do editor (Tiptap) em jsonb, até 400 KB. Idempotente. NÃO aplicar sem o aval do Arthur.

create table if not exists public.evento_anotacoes (
  evento_id uuid primary key references public.eventos(id) on delete cascade,
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array' and pg_column_size(blocks) <= 400000),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists evento_anotacoes_ws_idx on public.evento_anotacoes (workspace_id);

drop trigger if exists evento_anotacoes_touch on public.evento_anotacoes;
create trigger evento_anotacoes_touch before update on public.evento_anotacoes for each row execute function public.fn_touch_updated_at();

alter table public.evento_anotacoes enable row level security;
drop policy if exists tenant_isolation_evento_anotacoes_all on public.evento_anotacoes;
create policy tenant_isolation_evento_anotacoes_all on public.evento_anotacoes for all to authenticated
  using (workspace_id in (select public.fn_my_workspaces())) with check (workspace_id in (select public.fn_my_workspaces()));
revoke all on public.evento_anotacoes from anon, authenticated;
grant select, insert, update, delete on public.evento_anotacoes to authenticated;
