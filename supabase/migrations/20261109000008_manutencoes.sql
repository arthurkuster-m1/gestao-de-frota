-- manifest: manutenções do veículo (inclui sinistros): status Solicitar DA / Em reparo / Pronto, período e se bloqueia o uso do carro.
-- Uma manutenção é um período em que o carro está na oficina. `bloqueia_uso` é decisão do Arthur por registro
-- (um sinistro pode ou não impedir o carro de ir a evento). O evento responsável NÃO é gravado: é calculado pela
-- reserva que cobria o carro em `data_ocorrencia`. Idempotente.

create table if not exists public.manutencoes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  veiculo_id uuid not null,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  tipo text check (tipo is null or length(btrim(tipo)) between 1 and 60),          -- vocabulário aberto (Sinistro, Mecânica, Revisão…)
  status text not null default 'solicitar_da' check (status in ('solicitar_da', 'em_reparo', 'pronto')),
  data_ocorrencia date,                                                           -- quando o acidente/problema aconteceu
  data_da_solicitada date,                                                        -- quando a DA foi solicitada
  data_inicio date not null default (now() at time zone 'America/Sao_Paulo')::date,
  data_fim date,
  bloqueia_uso boolean not null default true,
  descricao text check (descricao is null or length(descricao) <= 2000),
  comentarios text check (comentarios is null or length(comentarios) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_fim is null or data_fim >= data_inicio),
  foreign key (veiculo_id, workspace_id) references public.veiculos (id, workspace_id) on delete cascade
);
create index if not exists manutencoes_veiculo_idx on public.manutencoes (workspace_id, veiculo_id, data_inicio);

drop trigger if exists manutencoes_touch on public.manutencoes;
create trigger manutencoes_touch before update on public.manutencoes for each row execute function public.fn_touch_updated_at();

-- Ao ficar "Pronto" sem data de fim, o fim é hoje (fuso de São Paulo). Só mexe na própria linha.
create or replace function public.fn_manutencao_fecha()
returns trigger language plpgsql set search_path = public as $$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if new.status = 'pronto' and new.data_fim is null then
    new.data_fim := greatest(hoje, new.data_inicio);
  end if;
  return new;
end $$;
drop trigger if exists manutencoes_fecha on public.manutencoes;
create trigger manutencoes_fecha before insert or update on public.manutencoes for each row execute function public.fn_manutencao_fecha();
revoke execute on function public.fn_manutencao_fecha() from public, anon, authenticated;

-- Histórico do carro (só grava linha; nunca faz chamada de rede).
create or replace function public.fn_manutencao_historico()
returns trigger language plpgsql set search_path = public as $$
declare rotulo text;
begin
  if tg_op = 'INSERT' then
    insert into public.veiculo_atividades (workspace_id, veiculo_id, tipo, descricao, ref_tipo, ref_id)
    values (new.workspace_id, new.veiculo_id, 'manutencao', 'Manutenção aberta: ' || new.nome, 'manutencao', new.id);
  elsif new.status is distinct from old.status then
    rotulo := case new.status when 'solicitar_da' then 'Solicitar DA' when 'em_reparo' then 'Em reparo' else 'Pronto' end;
    insert into public.veiculo_atividades (workspace_id, veiculo_id, tipo, descricao, ref_tipo, ref_id)
    values (new.workspace_id, new.veiculo_id, 'manutencao', 'Manutenção ' || new.nome || ': ' || rotulo, 'manutencao', new.id);
  end if;
  return null;
end $$;
drop trigger if exists manutencoes_historico on public.manutencoes;
create trigger manutencoes_historico after insert or update on public.manutencoes for each row execute function public.fn_manutencao_historico();
revoke execute on function public.fn_manutencao_historico() from public, anon, authenticated;

alter table public.manutencoes enable row level security;
drop policy if exists tenant_isolation_manutencoes_all on public.manutencoes;
create policy tenant_isolation_manutencoes_all on public.manutencoes for all to authenticated
  using (workspace_id in (select public.fn_my_workspaces()))
  with check (workspace_id in (select public.fn_my_workspaces()));
revoke all on public.manutencoes from anon, authenticated;
grant select, insert, update, delete on public.manutencoes to authenticated;
