-- manifest: transportes (ida/volta, PTA/TSO/retirada, km e dias de viagem), pagamentos (PTA e NF da TSO) e o vínculo de cada reserva com seus transportes.
-- Transporte agrupa vários carros (cada reserva aponta para o seu de ida e o seu de volta). Pagamento pode cobrir vários transportes
-- (a TSO combina ida e volta num orçamento só). Dias de viagem = km ÷ 500 para cima (retirada = 0), calculados pelo banco e ajustáveis.
-- Valores em reais (numeric 12,2). Idempotente.

create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  tipo text not null check (tipo in ('pta', 'nf_tso')),
  numero text not null check (length(btrim(numero)) between 1 and 60),
  status text not null,
  valor_planejado numeric(12, 2) check (valor_planejado is null or valor_planejado >= 0),
  valor_real numeric(12, 2) check (valor_real is null or valor_real >= 0),
  data_pagamento date,
  departamento text check (departamento is null or length(btrim(departamento)) between 1 and 80),
  comentarios text check (comentarios is null or length(comentarios) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  -- cada tipo tem a sua sequência de status
  check ((tipo = 'pta' and status in ('solicitado', 'aprovado', 'pago'))
      or (tipo = 'nf_tso' and status in ('orcamento_recebido', 'aprovar_nf', 'aprovado')))
);
create unique index if not exists pagamentos_numero_uidx on public.pagamentos (workspace_id, tipo, lower(btrim(numero)));

create or replace function public.fn_pagamento_preenche()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is null then
    new.status := case new.tipo when 'pta' then 'solicitado' else 'orcamento_recebido' end;
  end if;
  if new.status = 'pago' and new.data_pagamento is null then
    new.data_pagamento := (now() at time zone 'America/Sao_Paulo')::date;
  end if;
  return new;
end $$;
drop trigger if exists pagamentos_preenche on public.pagamentos;
create trigger pagamentos_preenche before insert or update on public.pagamentos for each row execute function public.fn_pagamento_preenche();
drop trigger if exists pagamentos_touch on public.pagamentos;
create trigger pagamentos_touch before update on public.pagamentos for each row execute function public.fn_touch_updated_at();
revoke execute on function public.fn_pagamento_preenche() from public, anon, authenticated;

create table if not exists public.transportes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  evento_id uuid not null,
  sentido text not null check (sentido in ('ida', 'volta')),
  modalidade text not null check (modalidade in ('pta', 'tso', 'retirada')),
  distancia_km integer check (distancia_km is null or distancia_km between 0 and 20000),
  dias_viagem integer not null check (dias_viagem between 0 and 60),
  referencia text check (referencia is null or length(btrim(referencia)) between 1 and 60),       -- ex.: PTAS00666314
  transportadora text check (transportadora is null or length(btrim(transportadora)) between 1 and 80),
  valor_planejado numeric(12, 2) check (valor_planejado is null or valor_planejado >= 0),
  pagamento_id uuid,
  comentarios text check (comentarios is null or length(comentarios) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (evento_id, workspace_id) references public.eventos (id, workspace_id) on delete cascade,
  -- apagar o pagamento solta o transporte (não o apaga); a coluna do espaço fica
  foreign key (pagamento_id, workspace_id) references public.pagamentos (id, workspace_id) on delete set null (pagamento_id)
);
create index if not exists transportes_evento_idx on public.transportes (workspace_id, evento_id);
create index if not exists transportes_pagamento_idx on public.transportes (pagamento_id);

-- Dias de viagem = km ÷ 500 para cima (retirada: 0). Preenche na criação e recalcula quando km ou modalidade mudam
-- sem que os dias tenham sido mexidos na mesma gravação (ajuste à mão vale). Também confere se o pagamento combina com a modalidade.
create or replace function public.fn_transporte_regras()
returns trigger language plpgsql set search_path = public as $$
declare calc integer; tipo_pag text;
begin
  calc := case when new.modalidade = 'retirada' then 0 else coalesce(ceil(new.distancia_km / 500.0)::integer, 0) end;
  if tg_op = 'INSERT' then
    if new.dias_viagem is null then new.dias_viagem := calc; end if;
  elsif (new.distancia_km is distinct from old.distancia_km or new.modalidade is distinct from old.modalidade)
        and new.dias_viagem is not distinct from old.dias_viagem then
    new.dias_viagem := calc;
  end if;
  if new.pagamento_id is not null then
    select tipo into tipo_pag from public.pagamentos where id = new.pagamento_id and workspace_id = new.workspace_id;
    if not ((new.modalidade = 'pta' and tipo_pag = 'pta') or (new.modalidade = 'tso' and tipo_pag = 'nf_tso')) then
      raise exception 'transporte_pagamento_incompativel: PTA liga com pagamento de PTA e TSO com NF da TSO' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists transportes_regras on public.transportes;
create trigger transportes_regras before insert or update on public.transportes for each row execute function public.fn_transporte_regras();
drop trigger if exists transportes_touch on public.transportes;
create trigger transportes_touch before update on public.transportes for each row execute function public.fn_touch_updated_at();
revoke execute on function public.fn_transporte_regras() from public, anon, authenticated;

-- Cada reserva aponta para o transporte de ida e o de volta (vários carros dividem o mesmo transporte).
alter table public.evento_veiculos add column if not exists transporte_ida_id uuid;
alter table public.evento_veiculos add column if not exists transporte_volta_id uuid;
alter table public.evento_veiculos drop constraint if exists evento_veiculos_transporte_ida_fk;
alter table public.evento_veiculos add constraint evento_veiculos_transporte_ida_fk
  foreign key (transporte_ida_id, workspace_id) references public.transportes (id, workspace_id) on delete set null (transporte_ida_id);
alter table public.evento_veiculos drop constraint if exists evento_veiculos_transporte_volta_fk;
alter table public.evento_veiculos add constraint evento_veiculos_transporte_volta_fk
  foreign key (transporte_volta_id, workspace_id) references public.transportes (id, workspace_id) on delete set null (transporte_volta_id);
create index if not exists evento_veiculos_transporte_ida_idx on public.evento_veiculos (transporte_ida_id) where transporte_ida_id is not null;
create index if not exists evento_veiculos_transporte_volta_idx on public.evento_veiculos (transporte_volta_id) where transporte_volta_id is not null;

-- O transporte da reserva tem de ser do MESMO evento e do sentido certo.
create or replace function public.fn_reserva_transporte_valida()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.transporte_ida_id is not null and not exists (
    select 1 from public.transportes t where t.id = new.transporte_ida_id and t.workspace_id = new.workspace_id and t.evento_id = new.evento_id and t.sentido = 'ida') then
    raise exception 'reserva_transporte_invalido: o transporte de ida tem de ser de ida e do mesmo evento' using errcode = '23514';
  end if;
  if new.transporte_volta_id is not null and not exists (
    select 1 from public.transportes t where t.id = new.transporte_volta_id and t.workspace_id = new.workspace_id and t.evento_id = new.evento_id and t.sentido = 'volta') then
    raise exception 'reserva_transporte_invalido: o transporte de volta tem de ser de volta e do mesmo evento' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists evento_veiculos_transporte_valida on public.evento_veiculos;
create trigger evento_veiculos_transporte_valida before insert or update of transporte_ida_id, transporte_volta_id on public.evento_veiculos for each row execute function public.fn_reserva_transporte_valida();
revoke execute on function public.fn_reserva_transporte_valida() from public, anon, authenticated;

alter table public.pagamentos enable row level security;
alter table public.transportes enable row level security;
do $$
declare t text;
begin
  foreach t in array array['pagamentos', 'transportes'] loop
    execute format('drop policy if exists %I on public.%I', 'tenant_isolation_' || t || '_all', t);
    execute format('create policy %I on public.%I for all to authenticated
                    using (workspace_id in (select public.fn_my_workspaces()))
                    with check (workspace_id in (select public.fn_my_workspaces()))', 'tenant_isolation_' || t || '_all', t);
  end loop;
end $$;
revoke all on public.pagamentos, public.transportes from anon, authenticated;
grant select, insert, update, delete on public.pagamentos, public.transportes to authenticated;
