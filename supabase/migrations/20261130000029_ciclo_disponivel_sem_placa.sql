-- manifest: volta o status entre "Disponível sem faturamento" e "Em blindagem", agora chamado "Disponível sem placa":
-- o carro já foi faturado, mas ainda não foi emplacado. Idempotente.
alter table public.veiculos drop constraint if exists veiculos_status_ciclo_check;
alter table public.veiculos add constraint veiculos_status_ciclo_check check (status_ciclo in (
  'pedido_recebido', 'liberado', 'em_transporte_0km', 'disponivel_sem_faturamento', 'disponivel_sem_placa', 'em_blindagem', 'disponivel', 'gravame', 'venda_vip', 'em_devolucao', 'devolvido'));

-- Carros que já estão faturados, ainda sem placa, passam para o status novo.
update public.veiculos set status_ciclo = 'disponivel_sem_placa'
 where status_ciclo = 'disponivel_sem_faturamento' and data_faturamento is not null and data_emplacamento is null;

create or replace function public.fn_veiculo_ciclo_auto()
returns trigger language plpgsql set search_path = public as $$
declare
  ordem text[] := array['pedido_recebido', 'liberado', 'em_transporte_0km', 'disponivel_sem_faturamento', 'disponivel_sem_placa',
                        'em_blindagem', 'disponivel', 'gravame', 'venda_vip', 'em_devolucao', 'devolvido'];
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  status_mudou boolean := (tg_op = 'UPDATE' and new.status_ciclo is distinct from old.status_ciclo);
  pos int := array_position(ordem, new.status_ciclo);
begin
  if status_mudou then
    if new.status_ciclo = 'pedido_recebido' and new.data_pedido is null then new.data_pedido := hoje; end if;
    if new.status_ciclo = 'liberado' and new.data_liberacao is null then new.data_liberacao := hoje; end if;
    if new.status_ciclo = 'disponivel_sem_faturamento' and new.data_chegada_planta is null then new.data_chegada_planta := hoje; end if;
    if new.status_ciclo = 'disponivel_sem_placa' and new.data_faturamento is null then new.data_faturamento := hoje; end if;
    if new.status_ciclo = 'disponivel' and new.data_emplacamento is null then new.data_emplacamento := hoje; end if;
    if new.status_ciclo = 'devolvido' and new.data_devolucao is null then new.data_devolucao := hoje; end if;
    return new;
  end if;

  if new.data_liberacao is not null and (tg_op = 'INSERT' or old.data_liberacao is null) and pos < array_position(ordem, 'liberado') then
    new.status_ciclo := 'liberado';
  end if;
  pos := array_position(ordem, new.status_ciclo);
  if new.data_chegada_planta is not null and (tg_op = 'INSERT' or old.data_chegada_planta is null) and pos < array_position(ordem, 'disponivel_sem_faturamento') then
    new.status_ciclo := 'disponivel_sem_faturamento';
  end if;
  pos := array_position(ordem, new.status_ciclo);
  if new.data_faturamento is not null and (tg_op = 'INSERT' or old.data_faturamento is null) and new.status_ciclo = 'disponivel_sem_faturamento' then
    new.status_ciclo := 'disponivel_sem_placa';
  end if;
  pos := array_position(ordem, new.status_ciclo);
  if new.data_emplacamento is not null and (tg_op = 'INSERT' or old.data_emplacamento is null) and pos <= array_position(ordem, 'disponivel_sem_placa') then
    new.status_ciclo := case when new.blindado then 'em_blindagem' else 'disponivel' end;
  end if;
  if new.data_devolucao is not null and (tg_op = 'INSERT' or old.data_devolucao is null) and new.status_ciclo <> 'devolvido' then
    new.status_ciclo := 'devolvido';
  end if;
  return new;
end $$;
revoke execute on function public.fn_veiculo_ciclo_auto() from public, anon, authenticated;
