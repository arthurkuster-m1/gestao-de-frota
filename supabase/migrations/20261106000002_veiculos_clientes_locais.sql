-- Veículos, clientes, motoristas e locais (base do domínio da Frota) + histórico do veículo.
-- Idempotente. Toda tabela leva workspace_id e RLS "sou membro deste espaço" (padrão do núcleo, migration 0001).
-- Decisões: docs/plano-app.md. Vocabulários abertos (tipo de atividade) ficam no TypeScript, sem CHECK;
-- vocabulários fechados (status do ciclo de vida, seguro, tipo de pessoa) têm CHECK.

-- ───────────────────────── veículos ─────────────────────────
create table if not exists public.veiculos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  modelo text not null check (length(trim(modelo)) > 0),
  cor text,
  my text,                                   -- ano-modelo, como vier ("2026", "26/27")
  pedido text,                               -- número do pedido na fábrica
  vin text check (vin is null or vin ~ '^[A-Z0-9]{17}$'),
  placa text check (placa is null or placa ~ '^[A-Z0-9]{7}$'),
  blindado boolean not null default false,
  seguro_status text not null default 'pendente' check (seguro_status in ('pendente', 'cadastrado', 'cancelado')),
  status_ciclo text not null default 'pedido_recebido' check (status_ciclo in (
    'pedido_recebido', 'liberado', 'em_transporte_0km', 'disponivel_sem_faturamento', 'revisao_emplacamento',
    'em_blindagem', 'disponivel', 'gravame', 'venda_vip', 'em_devolucao', 'devolvido')),
  data_pedido date, data_liberacao date, data_faturamento date, data_emplacamento date, data_devolucao date,
  decisao_devolucao text check (decisao_devolucao in ('devolver', 'manter')),
  data_devolucao_prevista date,
  comentarios text,
  custom jsonb not null default '{}'::jsonb,
  -- Código = MODELO + 4 últimos dígitos do VIN. Calculado, nunca digitado (vazio enquanto não há VIN).
  codigo text generated always as (
    case when vin is null then null else upper(trim(modelo)) || ' ' || right(vin, 4) end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index if not exists veiculos_vin_uidx on public.veiculos (workspace_id, vin) where vin is not null;
create unique index if not exists veiculos_placa_uidx on public.veiculos (workspace_id, placa) where placa is not null;
create index if not exists veiculos_ciclo_idx on public.veiculos (workspace_id, status_ciclo);

-- ───────────────────────── histórico do veículo (só acrescenta) ─────────────────────────
create table if not exists public.veiculo_atividades (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  veiculo_id uuid not null,
  tipo text not null,                        -- vocabulário aberto: vive no TypeScript (lib/atividades)
  ocorreu_em timestamptz not null default now(),
  descricao text not null,
  ref_tipo text, ref_id uuid,                -- ponteiro para o que causou (evento, manutenção…)
  criado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- o veículo tem de ser do MESMO espaço (a FK ignora RLS; sem isto dava para apontar para carro de outro espaço)
  foreign key (veiculo_id, workspace_id) references public.veiculos (id, workspace_id) on delete cascade
);
create index if not exists veiculo_atividades_idx on public.veiculo_atividades (veiculo_id, ocorreu_em desc);

-- ───────────────────────── clientes e motoristas ─────────────────────────
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  tipo_pessoa text not null default 'juridica' check (tipo_pessoa in ('fisica', 'juridica')),
  nome text not null check (length(trim(nome)) > 0),     -- nome completo (PF) ou razão social (PJ)
  documento text,                                        -- CPF (11 dígitos) ou CNPJ (14), só dígitos
  email text,
  cep text, endereco text, numero text, complemento text, cidade text,
  estado text check (estado is null or estado ~ '^[A-Z]{2}$'),
  testemunha_nome text, testemunha_email text,
  comentarios text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (documento is null
         or (tipo_pessoa = 'fisica' and documento ~ '^[0-9]{11}$')
         or (tipo_pessoa = 'juridica' and documento ~ '^[0-9]{14}$'))
);
create unique index if not exists clientes_documento_uidx on public.clientes (workspace_id, documento) where documento is not null;

create table if not exists public.cliente_motoristas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  cliente_id uuid not null,
  nome text not null check (length(trim(nome)) > 0),
  cpf text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  cnh_registro text,
  cnh_validade date,
  created_at timestamptz not null default now(),
  foreign key (cliente_id, workspace_id) references public.clientes (id, workspace_id) on delete cascade
);
create index if not exists cliente_motoristas_idx on public.cliente_motoristas (cliente_id);

-- ───────────────────────── locais (saída e evento) ─────────────────────────
create table if not exists public.locais (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  cep text, endereco text, numero text, complemento text, cidade text,
  estado text check (estado is null or estado ~ '^[A-Z]{2}$'),
  contato_nome text, contato_telefone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index if not exists locais_nome_uidx on public.locais (workspace_id, lower(nome));

-- ───────────────────────── gatilhos ─────────────────────────
drop trigger if exists veiculos_touch on public.veiculos;
create trigger veiculos_touch before update on public.veiculos for each row execute function public.fn_touch_updated_at();
drop trigger if exists clientes_touch on public.clientes;
create trigger clientes_touch before update on public.clientes for each row execute function public.fn_touch_updated_at();
drop trigger if exists locais_touch on public.locais;
create trigger locais_touch before update on public.locais for each row execute function public.fn_touch_updated_at();

-- Histórico automático do ciclo de vida (nunca faz chamada de rede; só grava linha).
create or replace function public.fn_veiculo_historico()
returns trigger language plpgsql set search_path = public as $$
declare
  r record;
begin
  if tg_op = 'INSERT' then
    insert into public.veiculo_atividades (workspace_id, veiculo_id, tipo, descricao)
    values (new.workspace_id, new.id, 'cadastro', 'Veículo cadastrado (' || new.status_ciclo || ')');
  else
    if new.status_ciclo is distinct from old.status_ciclo then
      insert into public.veiculo_atividades (workspace_id, veiculo_id, tipo, descricao)
      values (new.workspace_id, new.id, 'ciclo_vida', 'Ciclo de vida: ' || old.status_ciclo || ' → ' || new.status_ciclo);
    end if;
    for r in
      select * from (values
        ('pedido_recebido', 'Pedido recebido', old.data_pedido, new.data_pedido),
        ('liberacao', 'Liberado', old.data_liberacao, new.data_liberacao),
        ('faturamento', 'Faturado', old.data_faturamento, new.data_faturamento),
        ('emplacamento', 'Emplacado', old.data_emplacamento, new.data_emplacamento),
        ('devolucao', 'Devolvido', old.data_devolucao, new.data_devolucao)
      ) as t(tipo, rotulo, antes, depois) where depois is distinct from antes and depois is not null
    loop
      insert into public.veiculo_atividades (workspace_id, veiculo_id, tipo, ocorreu_em, descricao)
      values (new.workspace_id, new.id, r.tipo, r.depois::timestamptz, r.rotulo || ' em ' || to_char(r.depois, 'DD/MM/YYYY'));
    end loop;
  end if;
  return null;
end $$;

drop trigger if exists veiculos_historico on public.veiculos;
create trigger veiculos_historico after insert or update on public.veiculos for each row execute function public.fn_veiculo_historico();

-- Função nova em public nasce exposta: revoga as DUAS origens (PUBLIC e anon).
revoke execute on function public.fn_veiculo_historico() from public, anon;

-- ───────────────────────── RLS ─────────────────────────
alter table public.veiculos enable row level security;
alter table public.veiculo_atividades enable row level security;
alter table public.clientes enable row level security;
alter table public.cliente_motoristas enable row level security;
alter table public.locais enable row level security;

do $$
declare t text;
begin
  foreach t in array array['veiculos', 'clientes', 'cliente_motoristas', 'locais'] loop
    execute format('drop policy if exists %I on public.%I', 'tenant_isolation_' || t || '_all', t);
    execute format('create policy %I on public.%I for all to authenticated
                    using (workspace_id in (select public.fn_my_workspaces()))
                    with check (workspace_id in (select public.fn_my_workspaces()))', 'tenant_isolation_' || t || '_all', t);
  end loop;
end $$;

-- Histórico: ler e acrescentar; nunca alterar nem apagar pelo app.
drop policy if exists tenant_isolation_veiculo_atividades_select on public.veiculo_atividades;
create policy tenant_isolation_veiculo_atividades_select on public.veiculo_atividades for select to authenticated
  using (workspace_id in (select public.fn_my_workspaces()));
drop policy if exists tenant_isolation_veiculo_atividades_insert on public.veiculo_atividades;
create policy tenant_isolation_veiculo_atividades_insert on public.veiculo_atividades for insert to authenticated
  with check (workspace_id in (select public.fn_my_workspaces()));

-- Privilégios: o Supabase concede tudo por padrão a anon/authenticated; tiramos e devolvemos só o necessário.
revoke all on public.veiculos, public.veiculo_atividades, public.clientes, public.cliente_motoristas, public.locais from anon, authenticated;
grant select, insert, update, delete on public.veiculos, public.clientes, public.cliente_motoristas, public.locais to authenticated;
grant select, insert on public.veiculo_atividades to authenticated;
