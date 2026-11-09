-- O status do evento manda nos carros dele: mudar o status do evento (ou o status individual de um carro) atualiza o ESTADO da reserva,
-- e é o estado da reserva que faz o Status de Uso do veículo ("Em uso", "Em retorno"…) e a Agenda.
--   planejado / solicitar transporte / envio solicitado → reservado
--   em uso → em uso · solicitar retorno / retorno solicitado → em retorno · concluído → concluído
-- Reserva cancelada nunca muda. Carro com status individual segue o PRÓPRIO status, não o do evento. Idempotente.

create or replace function public.fn_estado_da_reserva(status_evento text)
returns text language sql immutable set search_path = public as $$
  select case status_evento when 'em_uso' then 'em_uso' when 'solicitar_retorno' then 'em_retorno' when 'retorno_solicitado' then 'em_retorno' when 'concluido' then 'concluido' else 'reservado' end
$$;

-- 1) o evento mudou de status: os carros dele (sem status individual) acompanham
create or replace function public.fn_evento_status_para_reservas()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    update public.evento_veiculos
       set estado = public.fn_estado_da_reserva(new.status)
     where evento_id = new.id and workspace_id = new.workspace_id and estado <> 'cancelado' and status_individual is null
       and estado is distinct from public.fn_estado_da_reserva(new.status);
  end if;
  return null;
end $$;
drop trigger if exists eventos_status_reservas on public.eventos;
create trigger eventos_status_reservas after update of status on public.eventos for each row execute function public.fn_evento_status_para_reservas();

-- 2) o status individual do carro mudou: a reserva dele segue (e, ao limpar, volta a seguir o evento)
-- 3) carro novo no evento já nasce no estado que o evento (ou o status individual) pede
create or replace function public.fn_reserva_estado_pelo_status()
returns trigger language plpgsql set search_path = public as $$
declare st text;
begin
  if new.estado = 'cancelado' then return new; end if;
  if tg_op = 'UPDATE' and new.status_individual is not distinct from old.status_individual then return new; end if;
  if tg_op = 'INSERT' and new.estado <> 'reservado' then return new;   -- estado escolhido de propósito (ex.: importação de evento histórico)
  end if;
  st := coalesce(new.status_individual, (select e.status from public.eventos e where e.id = new.evento_id and e.workspace_id = new.workspace_id));
  if st is not null then new.estado := public.fn_estado_da_reserva(st); end if;
  return new;
end $$;
drop trigger if exists evento_veiculos_estado_status on public.evento_veiculos;
create trigger evento_veiculos_estado_status before insert or update of status_individual on public.evento_veiculos for each row execute function public.fn_reserva_estado_pelo_status();

revoke execute on function public.fn_evento_status_para_reservas() from public, anon, authenticated;
revoke execute on function public.fn_reserva_estado_pelo_status() from public, anon, authenticated;

-- Eventos que já estavam num status adiante e cujos carros ficaram para trás: só AVANÇA (nunca desfaz um estado já adiantado, como o de um checklist).
update public.evento_veiculos r
   set estado = public.fn_estado_da_reserva(e.status)
  from public.eventos e
 where e.id = r.evento_id and e.workspace_id = r.workspace_id and r.estado <> 'cancelado' and r.status_individual is null
   and e.status in ('em_uso', 'solicitar_retorno', 'retorno_solicitado', 'concluido')
   and array_position(array['reservado', 'em_uso', 'em_retorno', 'concluido'], public.fn_estado_da_reserva(e.status))
     > array_position(array['reservado', 'em_uso', 'em_retorno', 'concluido'], r.estado);
