-- manifest: contratos de comodato (um por evento, com cliente, vigência, carros e status) e aditivos (troca de carros e extensão de prazo).
-- Os carros e a vigência EM VIGOR não são gravados: saem do contrato + aditivos assinados (calculado no app). contrato_veiculos guarda só os carros do
-- contrato original; o aditivo de troca guarda quais carros saem e quais entram. Idempotente.

create table if not exists public.contratos_comodato (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  evento_id uuid not null,
  cliente_id uuid not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'aguardando_assinaturas', 'assinado', 'encerrado')),
  vigencia_inicio date,
  vigencia_fim date,
  assinado_em date,
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (vigencia_inicio is null or vigencia_fim is null or vigencia_fim >= vigencia_inicio),
  -- evento e cliente têm de ser do MESMO espaço (a FK ignora RLS); não dá para apagar evento ou cliente que tem contrato
  foreign key (evento_id, workspace_id) references public.eventos (id, workspace_id) on delete restrict,
  foreign key (cliente_id, workspace_id) references public.clientes (id, workspace_id) on delete restrict
);
-- um contrato por evento (o que muda depois entra como aditivo)
create unique index if not exists contratos_evento_uidx on public.contratos_comodato (workspace_id, evento_id);
create index if not exists contratos_cliente_idx on public.contratos_comodato (workspace_id, cliente_id);

create table if not exists public.contrato_veiculos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  contrato_id uuid not null,
  veiculo_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (contrato_id, workspace_id) references public.contratos_comodato (id, workspace_id) on delete cascade,
  foreign key (veiculo_id, workspace_id) references public.veiculos (id, workspace_id) on delete cascade,
  unique (contrato_id, veiculo_id)
);
create index if not exists contrato_veiculos_veiculo_idx on public.contrato_veiculos (veiculo_id);

create table if not exists public.contrato_aditivos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  contrato_id uuid not null,
  tipo text not null check (tipo in ('troca_carros', 'extensao_prazo')),
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'aguardando_assinaturas', 'assinado')),
  motivo text check (motivo is null or length(motivo) <= 2000),
  vigencia_fim_anterior date,                 -- a vigência que valia quando o aditivo foi feito (para o documento)
  vigencia_fim_nova date,                     -- só na extensão de prazo
  assinado_em date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (tipo <> 'extensao_prazo' or vigencia_fim_nova is not null),
  foreign key (contrato_id, workspace_id) references public.contratos_comodato (id, workspace_id) on delete cascade
);
create index if not exists contrato_aditivos_contrato_idx on public.contrato_aditivos (workspace_id, contrato_id, created_at);

-- Carros de um aditivo de troca: quais saem e quais entram.
create table if not exists public.contrato_aditivo_veiculos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  aditivo_id uuid not null,
  veiculo_id uuid not null,
  acao text not null check (acao in ('sai', 'entra')),
  foreign key (aditivo_id, workspace_id) references public.contrato_aditivos (id, workspace_id) on delete cascade,
  foreign key (veiculo_id, workspace_id) references public.veiculos (id, workspace_id) on delete cascade,
  unique (aditivo_id, veiculo_id)
);

-- Datas de assinatura: marcar Assinado sem data preenche com hoje (fuso de São Paulo). Só mexe na própria linha.
create or replace function public.fn_contrato_assinatura()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'assinado' and new.assinado_em is null then
    new.assinado_em := (now() at time zone 'America/Sao_Paulo')::date;
  end if;
  return new;
end $$;
drop trigger if exists contratos_assinatura on public.contratos_comodato;
create trigger contratos_assinatura before insert or update on public.contratos_comodato for each row execute function public.fn_contrato_assinatura();
drop trigger if exists contrato_aditivos_assinatura on public.contrato_aditivos;
create trigger contrato_aditivos_assinatura before insert or update on public.contrato_aditivos for each row execute function public.fn_contrato_assinatura();
revoke execute on function public.fn_contrato_assinatura() from public, anon, authenticated;

drop trigger if exists contratos_touch on public.contratos_comodato;
create trigger contratos_touch before update on public.contratos_comodato for each row execute function public.fn_touch_updated_at();
drop trigger if exists contrato_aditivos_touch on public.contrato_aditivos;
create trigger contrato_aditivos_touch before update on public.contrato_aditivos for each row execute function public.fn_touch_updated_at();

alter table public.contratos_comodato enable row level security;
alter table public.contrato_veiculos enable row level security;
alter table public.contrato_aditivos enable row level security;
alter table public.contrato_aditivo_veiculos enable row level security;
do $$
declare t text;
begin
  foreach t in array array['contratos_comodato', 'contrato_veiculos', 'contrato_aditivos', 'contrato_aditivo_veiculos'] loop
    execute format('drop policy if exists %I on public.%I', 'tenant_isolation_' || t || '_all', t);
    execute format('create policy %I on public.%I for all to authenticated
                    using (workspace_id in (select public.fn_my_workspaces()))
                    with check (workspace_id in (select public.fn_my_workspaces()))', 'tenant_isolation_' || t || '_all', t);
  end loop;
end $$;
revoke all on public.contratos_comodato, public.contrato_veiculos, public.contrato_aditivos, public.contrato_aditivo_veiculos from anon, authenticated;
grant select, insert, update, delete on public.contratos_comodato, public.contrato_veiculos, public.contrato_aditivos, public.contrato_aditivo_veiculos to authenticated;
