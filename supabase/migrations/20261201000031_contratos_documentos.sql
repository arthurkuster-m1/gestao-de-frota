-- manifest: contratos gerados dentro do evento (DOCX a partir de modelos), com os dados "congelados" (snapshot) e aditivos com título, data de efeito e documento.
-- Também guarda os MODELOS de documento do espaço (o app traz os padrões; aqui ficam os que a pessoa trocou nas Configurações). Idempotente.
alter table public.contratos_comodato add column if not exists snapshot jsonb;
alter table public.contrato_aditivos add column if not exists titulo text check (titulo is null or length(titulo) <= 200);
alter table public.contrato_aditivos add column if not exists data_efeito date;
alter table public.contrato_aditivos add column if not exists snapshot jsonb;

-- Depois de ASSINADO o contrato não muda mais (cliente, evento, vigência e dados do documento): o que mudar entra como aditivo.
create or replace function public.fn_contrato_travado()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status in ('assinado', 'encerrado') and (
       new.cliente_id is distinct from old.cliente_id or new.evento_id is distinct from old.evento_id
    or new.vigencia_inicio is distinct from old.vigencia_inicio or new.vigencia_fim is distinct from old.vigencia_fim
    or new.snapshot is distinct from old.snapshot) then
    raise exception 'contrato_assinado: contrato assinado não muda; use um aditivo' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists contratos_travado on public.contratos_comodato;
create trigger contratos_travado before update on public.contratos_comodato for each row execute function public.fn_contrato_travado();
revoke execute on function public.fn_contrato_travado() from public, anon, authenticated;

create table if not exists public.modelos_documento (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  tipo text not null check (tipo in ('contrato_comodato', 'aditivo_substituicao', 'aditivo_prorrogacao')),
  nome_arquivo text not null check (length(btrim(nome_arquivo)) between 1 and 200),
  conteudo text not null check (length(conteudo) <= 8000000),   -- o .docx em base64
  updated_at timestamptz not null default now(),
  unique (workspace_id, tipo)
);
drop trigger if exists modelos_documento_touch on public.modelos_documento;
create trigger modelos_documento_touch before update on public.modelos_documento for each row execute function public.fn_touch_updated_at();
alter table public.modelos_documento enable row level security;
drop policy if exists tenant_isolation_modelos_documento_all on public.modelos_documento;
create policy tenant_isolation_modelos_documento_all on public.modelos_documento for all to authenticated
  using (workspace_id in (select public.fn_my_workspaces())) with check (workspace_id in (select public.fn_my_workspaces()));
revoke all on public.modelos_documento from anon, authenticated;
grant select, insert, update, delete on public.modelos_documento to authenticated;
