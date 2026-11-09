-- Planejamento: período previsto do evento, modelos desejados (com "não estava disponível") e anotações do carro.
--  * `eventos.chegada_prevista/retirada_prevista`: as datas pedidas, para filtrar os carros livres no Planejamento.
--  * `evento_modelos_desejados`: UMA linha por carro pedido (modelo mãe, versão, cor, MY). `reserva_id` preenchido = atendido;
--    `nao_atendido` = o carro pedido não estava disponível (fica registrado; outros modelos podem ser reservados no lugar).
--  * `veiculo_anotacoes`: faixas livres na linha do tempo do carro (Produção, Em faturamento, Emplacamento…). Não aparecem em eventos nem manutenções.
-- Só adiciona; idempotente.

alter table public.eventos add column if not exists chegada_prevista date;
alter table public.eventos add column if not exists retirada_prevista date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'eventos_periodo_previsto_check') then
    alter table public.eventos add constraint eventos_periodo_previsto_check
      check (chegada_prevista is null or retirada_prevista is null or retirada_prevista >= chegada_prevista);
  end if;
end $$;

create table if not exists public.evento_modelos_desejados (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  evento_id uuid not null,
  modelo text not null check (length(btrim(modelo)) between 1 and 60),   -- modelo mãe (1ª palavra)
  versao text check (versao is null or length(btrim(versao)) between 1 and 80),
  cor text check (cor is null or length(btrim(cor)) between 1 and 40),
  my text check (my is null or length(btrim(my)) between 1 and 10),
  reserva_id uuid references public.evento_veiculos(id) on delete set null,
  nao_atendido boolean not null default false,
  nota text,
  posicao int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (evento_id, workspace_id) references public.eventos (id, workspace_id) on delete cascade,
  check (not (nao_atendido and reserva_id is not null))
);
create index if not exists evento_modelos_desejados_evento_idx on public.evento_modelos_desejados (evento_id, posicao);

create table if not exists public.veiculo_anotacoes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  veiculo_id uuid not null,
  titulo text not null check (length(btrim(titulo)) between 1 and 80),
  inicio date not null,
  fim date not null,
  comentarios text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim >= inicio),
  foreign key (veiculo_id, workspace_id) references public.veiculos (id, workspace_id) on delete cascade
);
create index if not exists veiculo_anotacoes_veiculo_idx on public.veiculo_anotacoes (workspace_id, veiculo_id, inicio);

drop trigger if exists evento_modelos_desejados_touch on public.evento_modelos_desejados;
create trigger evento_modelos_desejados_touch before update on public.evento_modelos_desejados for each row execute function public.fn_touch_updated_at();
drop trigger if exists veiculo_anotacoes_touch on public.veiculo_anotacoes;
create trigger veiculo_anotacoes_touch before update on public.veiculo_anotacoes for each row execute function public.fn_touch_updated_at();

alter table public.evento_modelos_desejados enable row level security;
alter table public.veiculo_anotacoes enable row level security;
do $$
declare t text;
begin
  foreach t in array array['evento_modelos_desejados', 'veiculo_anotacoes'] loop
    execute format('drop policy if exists %I on public.%I', 'tenant_isolation_' || t || '_all', t);
    execute format('create policy %I on public.%I for all to authenticated
                    using (workspace_id in (select public.fn_my_workspaces()))
                    with check (workspace_id in (select public.fn_my_workspaces()))', 'tenant_isolation_' || t || '_all', t);
  end loop;
end $$;
revoke all on public.evento_modelos_desejados, public.veiculo_anotacoes from anon, authenticated;
grant select, insert, update, delete on public.evento_modelos_desejados, public.veiculo_anotacoes to authenticated;
