-- manifest: checklists de saída e retorno por reserva (km, combustível, limpeza, quem recebeu, avarias, observações); saída põe a reserva Em uso e retorno a conclui.
-- Um checklist de cada momento por reserva. O de retorno não pode ter km menor que o de saída. Sem fotos (decisão do Arthur).
-- O estado da reserva só anda para a frente: saída leva Reservado → Em uso; retorno leva Reservado/Em uso/Em retorno → Concluído.
-- Apagar ou editar o checklist depois NÃO devolve o estado da reserva (isso o Arthur muda à mão). Idempotente.

-- a FK composta precisa de uma chave única (id, espaço) na reserva
create unique index if not exists evento_veiculos_id_workspace_uidx on public.evento_veiculos (id, workspace_id);

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.fn_default_workspace() references public.workspaces(id) on delete cascade,
  reserva_id uuid not null,
  momento text not null check (momento in ('saida', 'retorno')),
  data_hora timestamptz not null default now(),
  km integer check (km is null or km between 0 and 2000000),
  combustivel text check (combustivel is null or combustivel in ('vazio', 'um_quarto', 'meio', 'tres_quartos', 'cheio')),   -- ou carga, nos elétricos
  limpeza text check (limpeza is null or limpeza in ('limpo', 'regular', 'sujo')),
  recebido_por text check (recebido_por is null or length(btrim(recebido_por)) between 1 and 120),
  teve_avarias boolean not null default false,
  avarias text check (avarias is null or length(avarias) <= 2000),
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- "avarias: sim" exige dizer quais
  check (not teve_avarias or (avarias is not null and length(btrim(avarias)) > 0)),
  foreign key (reserva_id, workspace_id) references public.evento_veiculos (id, workspace_id) on delete cascade,
  unique (reserva_id, momento)
);
create index if not exists checklists_reserva_idx on public.checklists (workspace_id, reserva_id);

drop trigger if exists checklists_touch on public.checklists;
create trigger checklists_touch before update on public.checklists for each row execute function public.fn_touch_updated_at();

-- Retorno não pode ter km menor que a saída (só confere quando os dois km existem).
create or replace function public.fn_checklist_confere()
returns trigger language plpgsql set search_path = public as $$
declare outro integer;
begin
  if new.km is not null then
    select c.km into outro from public.checklists c
     where c.reserva_id = new.reserva_id and c.workspace_id = new.workspace_id and c.momento = case new.momento when 'saida' then 'retorno' else 'saida' end;
    if outro is not null and ((new.momento = 'retorno' and new.km < outro) or (new.momento = 'saida' and new.km > outro)) then
      raise exception 'checklist_km_invalido: o km do retorno não pode ser menor que o da saída' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists checklists_confere on public.checklists;
create trigger checklists_confere before insert or update on public.checklists for each row execute function public.fn_checklist_confere();
revoke execute on function public.fn_checklist_confere() from public, anon, authenticated;

-- Saída => Em uso; retorno => Concluído (só para a frente). Histórico do carro. Só grava linhas; nunca faz chamada de rede.
create or replace function public.fn_checklist_efeitos()
returns trigger language plpgsql set search_path = public as $$
declare r record;
begin
  select veiculo_id, estado into r from public.evento_veiculos where id = new.reserva_id and workspace_id = new.workspace_id;
  if not found then return null; end if;
  if tg_op = 'INSERT' then
    if new.momento = 'saida' and r.estado = 'reservado' then
      update public.evento_veiculos set estado = 'em_uso' where id = new.reserva_id and workspace_id = new.workspace_id;
    elsif new.momento = 'retorno' and r.estado in ('reservado', 'em_uso', 'em_retorno') then
      update public.evento_veiculos set estado = 'concluido' where id = new.reserva_id and workspace_id = new.workspace_id;
    end if;
    insert into public.veiculo_atividades (workspace_id, veiculo_id, tipo, descricao, ref_tipo, ref_id)
    values (new.workspace_id, r.veiculo_id, 'checklist',
            'Checklist de ' || case new.momento when 'saida' then 'saída' else 'retorno' end || coalesce(' (' || new.km || ' km)', '') || case when new.teve_avarias then ' com avarias' else '' end,
            'checklist', new.id);
  end if;
  return null;
end $$;
drop trigger if exists checklists_efeitos on public.checklists;
create trigger checklists_efeitos after insert on public.checklists for each row execute function public.fn_checklist_efeitos();
revoke execute on function public.fn_checklist_efeitos() from public, anon, authenticated;

alter table public.checklists enable row level security;
drop policy if exists tenant_isolation_checklists_all on public.checklists;
create policy tenant_isolation_checklists_all on public.checklists for all to authenticated
  using (workspace_id in (select public.fn_my_workspaces()))
  with check (workspace_id in (select public.fn_my_workspaces()));
revoke all on public.checklists from anon, authenticated;
grant select, insert, update, delete on public.checklists to authenticated;
