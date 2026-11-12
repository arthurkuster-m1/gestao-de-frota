-- manifest: Anotações (bloco de notas em páginas e subpáginas): `notes_pages` (árvore por espaço, blocos do editor em jsonb, busca sem acento, lixeira, Caixa de entrada) e `notes_user_state` (favorita e último acesso por pessoa). Todo membro do espaço lê e escreve. Idempotente. NÃO aplicar sem o aval do Arthur.

create table if not exists public.notes_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  parent_id uuid,
  kind text check (kind is null or kind = 'inbox'),            -- 'inbox' = a Caixa de entrada (uma por espaço)
  title text not null default '' check (length(title) <= 200),
  icon text check (icon is null or length(icon) <= 16),
  position numeric not null default 0,
  blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array' and pg_column_size(blocks) <= 400000),
  -- busca sem acento, mantida pelo app ao gravar (o texto vem de dentro do documento do editor)
  search_text text not null default '',
  search_fold text not null default '',
  title_fold text not null default '',
  deleted_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (parent_id is null or parent_id <> id),
  check (length(search_text) <= 400000 and length(search_fold) <= 400000 and length(title_fold) <= 400),
  -- a página-mãe é do MESMO espaço (a chave composta garante)
  foreign key (parent_id, workspace_id) references public.notes_pages (id, workspace_id) on delete cascade
);
create index if not exists notes_pages_parent_idx on public.notes_pages (workspace_id, parent_id, position);
create index if not exists notes_pages_deleted_idx on public.notes_pages (workspace_id, deleted_at);
create unique index if not exists notes_pages_inbox_uniq on public.notes_pages (workspace_id) where kind = 'inbox';

-- Guarda da árvore: sem ciclo e com teto de profundidade (12 níveis).
create or replace function public.fn_notes_pages_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_ciclo boolean; v_profundidade int;
begin
  if new.parent_id is null then return new; end if;
  with recursive cadeia(id, parent_id, nivel) as (
    select id, parent_id, 1 from public.notes_pages where id = new.parent_id
    union all
    select p.id, p.parent_id, c.nivel + 1 from public.notes_pages p join cadeia c on p.id = c.parent_id where c.nivel < 50
  )
  select coalesce(bool_or(id = new.id), false), coalesce(max(nivel), 0) into v_ciclo, v_profundidade from cadeia;
  if v_ciclo then raise exception 'notes_pages: uma página não pode ficar dentro dela mesma' using errcode = '23514'; end if;
  if v_profundidade >= 12 then raise exception 'notes_pages: subpáginas demais, uma dentro da outra' using errcode = '23514'; end if;
  return new;
end $$;
revoke execute on function public.fn_notes_pages_guard() from public, anon;
drop trigger if exists notes_pages_guard on public.notes_pages;
create trigger notes_pages_guard before insert or update of parent_id on public.notes_pages for each row execute function public.fn_notes_pages_guard();
drop trigger if exists notes_pages_touch on public.notes_pages;
create trigger notes_pages_touch before update on public.notes_pages for each row execute function public.fn_touch_updated_at();

alter table public.notes_pages enable row level security;
drop policy if exists tenant_isolation_notes_pages_all on public.notes_pages;
create policy tenant_isolation_notes_pages_all on public.notes_pages for all to authenticated
  using (workspace_id in (select public.fn_my_workspaces())) with check (workspace_id in (select public.fn_my_workspaces()));
revoke all on public.notes_pages from anon, authenticated;
grant select, insert, update, delete on public.notes_pages to authenticated;

-- Favorita e último acesso: cada pessoa só vê e mexe no próprio estado.
create table if not exists public.notes_user_state (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  page_id uuid not null,
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  favorite boolean not null default false,
  last_opened_at timestamptz,
  primary key (user_id, page_id),
  foreign key (page_id, workspace_id) references public.notes_pages (id, workspace_id) on delete cascade
);
create index if not exists notes_user_state_ws_idx on public.notes_user_state (user_id, workspace_id);
alter table public.notes_user_state enable row level security;
drop policy if exists notes_user_state_own on public.notes_user_state;
create policy notes_user_state_own on public.notes_user_state for all to authenticated
  using (user_id = auth.uid() and workspace_id in (select public.fn_my_workspaces()))
  with check (user_id = auth.uid() and workspace_id in (select public.fn_my_workspaces()));
revoke all on public.notes_user_state from anon, authenticated;
grant select, insert, update, delete on public.notes_user_state to authenticated;
