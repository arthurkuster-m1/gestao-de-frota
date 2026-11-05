-- Eventos e reservas de veículos (base do Status de Uso e da Agenda do carro).
--  * `eventos`: o motivo do uso (nome único por espaço, tipo, status em 7 etapas, solicitante).
--  * `evento_veiculos` (a RESERVA): um carro num evento, com o período (já contando a logística) e o estado:
--    reservado → em uso → em retorno → concluído (ou cancelado). Um carro pode ter várias reservas, em eventos diferentes.
-- O Status de Uso e a Agenda em texto do carro são CALCULADOS destas linhas (nunca digitados).
-- Idempotente. Locais, transportes, pagamentos, checklists e contratos entram em migrations próprias.

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  tipo text,                                   -- vocabulário aberto (Comodato longo, Evento, Gravação, Agrifeira…): vive no TypeScript
  status text not null default 'planejado' check (status in (
    'planejado', 'solicitar_transporte', 'envio_solicitado', 'em_uso', 'solicitar_retorno', 'retorno_solicitado', 'concluido')),
  solicitante text,
  comentarios text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index if not exists eventos_nome_uidx on public.eventos (workspace_id, lower(btrim(nome)));
create index if not exists eventos_status_idx on public.eventos (workspace_id, status);

create table if not exists public.evento_veiculos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  evento_id uuid not null,
  veiculo_id uuid not null,
  reserva_inicio date not null,                -- inclui o prazo de logística (ida)
  reserva_fim date not null,                   -- inclui o prazo de logística (volta)
  estado text not null default 'reservado' check (estado in ('reservado', 'em_uso', 'em_retorno', 'concluido', 'cancelado')),
  comentarios text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserva_fim >= reserva_inicio),
  -- evento e veículo têm de ser do MESMO espaço (a FK ignora RLS)
  foreign key (evento_id, workspace_id) references public.eventos (id, workspace_id) on delete cascade,
  foreign key (veiculo_id, workspace_id) references public.veiculos (id, workspace_id) on delete cascade,
  unique (evento_id, veiculo_id)
);
create index if not exists evento_veiculos_veiculo_idx on public.evento_veiculos (workspace_id, veiculo_id, reserva_inicio);
create index if not exists evento_veiculos_evento_idx on public.evento_veiculos (evento_id);

drop trigger if exists eventos_touch on public.eventos;
create trigger eventos_touch before update on public.eventos for each row execute function public.fn_touch_updated_at();
drop trigger if exists evento_veiculos_touch on public.evento_veiculos;
create trigger evento_veiculos_touch before update on public.evento_veiculos for each row execute function public.fn_touch_updated_at();

-- Histórico do carro: reserva criada e mudança de estado (só grava linha; nunca faz chamada de rede).
create or replace function public.fn_reserva_historico()
returns trigger language plpgsql set search_path = public as $$
declare
  nome_evento text;
  rotulo text;
begin
  select nome into nome_evento from public.eventos where id = new.evento_id;
  if tg_op = 'INSERT' then
    insert into public.veiculo_atividades (workspace_id, veiculo_id, tipo, descricao, ref_tipo, ref_id)
    values (new.workspace_id, new.veiculo_id, 'reserva',
            'Reservado para o evento ' || coalesce(nome_evento, '?') || ' (' || to_char(new.reserva_inicio, 'DD/MM/YYYY') || ' a ' || to_char(new.reserva_fim, 'DD/MM/YYYY') || ')', 'evento', new.evento_id);
  elsif new.estado is distinct from old.estado then
    rotulo := case new.estado when 'reservado' then 'voltou a reservado' when 'em_uso' then 'em uso' when 'em_retorno' then 'em retorno' when 'concluido' then 'concluído' else 'cancelado' end;
    insert into public.veiculo_atividades (workspace_id, veiculo_id, tipo, descricao, ref_tipo, ref_id)
    values (new.workspace_id, new.veiculo_id, 'uso', 'Evento ' || coalesce(nome_evento, '?') || ': ' || rotulo, 'evento', new.evento_id);
  end if;
  return null;
end $$;
drop trigger if exists evento_veiculos_historico on public.evento_veiculos;
create trigger evento_veiculos_historico after insert or update on public.evento_veiculos for each row execute function public.fn_reserva_historico();
revoke execute on function public.fn_reserva_historico() from public, anon, authenticated;

alter table public.eventos enable row level security;
alter table public.evento_veiculos enable row level security;
do $$
declare t text;
begin
  foreach t in array array['eventos', 'evento_veiculos'] loop
    execute format('drop policy if exists %I on public.%I', 'tenant_isolation_' || t || '_all', t);
    execute format('create policy %I on public.%I for all to authenticated
                    using (workspace_id in (select public.fn_my_workspaces()))
                    with check (workspace_id in (select public.fn_my_workspaces()))', 'tenant_isolation_' || t || '_all', t);
  end loop;
end $$;
revoke all on public.eventos, public.evento_veiculos from anon, authenticated;
grant select, insert, update, delete on public.eventos, public.evento_veiculos to authenticated;
