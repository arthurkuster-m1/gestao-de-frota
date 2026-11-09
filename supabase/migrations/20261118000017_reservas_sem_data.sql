-- Reservas SEM DATA: o carro entra no evento antes de o evento ter datas (cadastro rápido, evento "soltando" aos poucos).
-- As duas datas ficam vazias ou preenchidas juntas; preenchidas, valem as regras de sempre (fim >= início, chegada/retirada dentro do período).
-- Reserva sem data não pesa na agenda nem no status de uso do carro (nada a conflitar ainda). Idempotente.
alter table public.evento_veiculos alter column reserva_inicio drop not null;
alter table public.evento_veiculos alter column reserva_fim drop not null;
alter table public.evento_veiculos drop constraint if exists evento_veiculos_datas_juntas_check;
alter table public.evento_veiculos add constraint evento_veiculos_datas_juntas_check check ((reserva_inicio is null) = (reserva_fim is null));

-- O histórico do carro lia as datas para montar o texto: sem data, diz isso em vez de falhar.
create or replace function public.fn_reserva_historico()
returns trigger language plpgsql set search_path = public as $$
declare
  nome_evento text;
  rotulo text;
  periodo text;
begin
  select nome into nome_evento from public.eventos where id = new.evento_id;
  if tg_op = 'INSERT' then
    periodo := case when new.reserva_inicio is null then 'sem data definida'
                    else to_char(new.reserva_inicio, 'DD/MM/YYYY') || ' a ' || to_char(new.reserva_fim, 'DD/MM/YYYY') end;
    insert into public.veiculo_atividades (workspace_id, veiculo_id, tipo, descricao, ref_tipo, ref_id)
    values (new.workspace_id, new.veiculo_id, 'reserva',
            'Reservado para o evento ' || coalesce(nome_evento, '?') || ' (' || periodo || ')', 'evento', new.evento_id);
  elsif new.estado is distinct from old.estado then
    rotulo := case new.estado when 'reservado' then 'voltou a reservado' when 'em_uso' then 'em uso' when 'em_retorno' then 'em retorno' when 'concluido' then 'concluído' else 'cancelado' end;
    insert into public.veiculo_atividades (workspace_id, veiculo_id, tipo, descricao, ref_tipo, ref_id)
    values (new.workspace_id, new.veiculo_id, 'uso', 'Evento ' || coalesce(nome_evento, '?') || ': ' || rotulo, 'evento', new.evento_id);
  end if;
  return null;
end $$;
revoke execute on function public.fn_reserva_historico() from public, anon, authenticated;
