-- manifest: quando o ÚLTIMO carro do evento volta (reserva vai para Concluído pelo checklist de retorno ou à mão), o evento vira Concluído.
-- Só conta reservas não canceladas; se ainda houver carro reservado, em uso ou em retorno, o evento continua como está. Idempotente.
create or replace function public.fn_evento_conclui_com_ultimo_retorno()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.estado = 'concluido' and old.estado is distinct from 'concluido' then
    if not exists (select 1 from public.evento_veiculos r
                    where r.evento_id = new.evento_id and r.workspace_id = new.workspace_id and r.estado not in ('concluido', 'cancelado')) then
      update public.eventos set status = 'concluido'
       where id = new.evento_id and workspace_id = new.workspace_id and status <> 'concluido';
    end if;
  end if;
  return null;
end $$;
drop trigger if exists evento_veiculos_conclui_evento on public.evento_veiculos;
create trigger evento_veiculos_conclui_evento after update of estado on public.evento_veiculos for each row execute function public.fn_evento_conclui_com_ultimo_retorno();
revoke execute on function public.fn_evento_conclui_com_ultimo_retorno() from public, anon, authenticated;
