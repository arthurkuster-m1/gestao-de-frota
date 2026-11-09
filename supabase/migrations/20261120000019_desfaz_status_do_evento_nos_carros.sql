-- Desfaz a 0018: o status do evento NÃO põe os carros "em uso" sozinho. O carro só entra em uso quando o checklist de SAÍDA é registrado
-- (a regra da 0010 continua valendo). Ao colocar o evento em uso à mão, o app pede o checklist de saída dos carros (em massa, se quiser).
drop trigger if exists eventos_status_reservas on public.eventos;
drop trigger if exists evento_veiculos_estado_status on public.evento_veiculos;
drop function if exists public.fn_evento_status_para_reservas();
drop function if exists public.fn_reserva_estado_pelo_status();
drop function if exists public.fn_estado_da_reserva(text);

-- Reservas que a 0018 adiantou para "em uso" sem existir checklist de saída voltam a "reservado".
update public.evento_veiculos r
   set estado = 'reservado'
 where r.estado = 'em_uso' and r.status_individual is null
   and not exists (select 1 from public.checklists c where c.reserva_id = r.id and c.workspace_id = r.workspace_id and c.momento = 'saida');
