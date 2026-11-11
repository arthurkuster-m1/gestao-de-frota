-- manifest: campo "Faturado" (sim/não) no veículo, independente da data (carros do histórico antigo foram faturados mas não têm data). Idempotente.
-- Sincronia: ter data de faturamento, data de emplacamento ou estar em Disponível sem placa / Em blindagem / Pronto => faturado.
-- Marcar faturado num carro "Disponível sem faturamento" leva o ciclo a "Disponível sem placa" (sem inventar data).
alter table public.veiculos add column if not exists faturado boolean not null default false;

update public.veiculos set faturado = true
 where not faturado and (data_faturamento is not null or data_emplacamento is not null or status_ciclo in ('disponivel_sem_placa', 'em_blindagem', 'disponivel'));

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
    if new.status_ciclo = 'disponivel_sem_placa' and new.data_faturamento is null and not new.faturado then new.data_faturamento := hoje; end if;
    if new.status_ciclo = 'disponivel' and new.data_emplacamento is null then new.data_emplacamento := hoje; end if;
    if new.status_ciclo = 'devolvido' and new.data_devolucao is null then new.data_devolucao := hoje; end if;
  else
    if new.data_liberacao is not null and (tg_op = 'INSERT' or old.data_liberacao is null) and pos < array_position(ordem, 'liberado') then
      new.status_ciclo := 'liberado';
    end if;
    pos := array_position(ordem, new.status_ciclo);
    if new.data_chegada_planta is not null and (tg_op = 'INSERT' or old.data_chegada_planta is null) and pos < array_position(ordem, 'disponivel_sem_faturamento') then
      new.status_ciclo := 'disponivel_sem_faturamento';
    end if;
    pos := array_position(ordem, new.status_ciclo);
    -- faturou (pela data OU marcando o campo): o carro que esperava faturamento passa a esperar a placa
    if new.status_ciclo = 'disponivel_sem_faturamento' and (
         (new.data_faturamento is not null and (tg_op = 'INSERT' or old.data_faturamento is null))
      or (new.faturado and (tg_op = 'INSERT' or not old.faturado))) then
      new.status_ciclo := 'disponivel_sem_placa';
    end if;
    pos := array_position(ordem, new.status_ciclo);
    if new.data_emplacamento is not null and (tg_op = 'INSERT' or old.data_emplacamento is null) and pos <= array_position(ordem, 'disponivel_sem_placa') then
      new.status_ciclo := case when new.blindado then 'em_blindagem' else 'disponivel' end;
    end if;
    if new.data_devolucao is not null and (tg_op = 'INSERT' or old.data_devolucao is null) and new.status_ciclo <> 'devolvido' then
      new.status_ciclo := 'devolvido';
    end if;
  end if;
  -- faturado acompanha tudo que prova o faturamento
  if new.data_faturamento is not null or new.data_emplacamento is not null or new.status_ciclo in ('disponivel_sem_placa', 'em_blindagem', 'disponivel') then
    new.faturado := true;
  end if;
  return new;
end $$;
revoke execute on function public.fn_veiculo_ciclo_auto() from public, anon, authenticated;
