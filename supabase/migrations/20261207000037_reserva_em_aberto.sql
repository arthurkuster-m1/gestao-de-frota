-- manifest: reserva EM ABERTO: o carro entra no evento com início e sem data final (evento contínuo, em que o carro não volta).
-- Antes as duas datas ficavam vazias ou preenchidas juntas; agora o fim também pode ficar vazio com o início preenchido. Idempotente.
alter table public.evento_veiculos drop constraint if exists evento_veiculos_datas_juntas_check;
alter table public.evento_veiculos add constraint evento_veiculos_datas_juntas_check check (reserva_fim is null or reserva_inicio is not null);

-- O histórico do carro monta o texto com as datas: reserva em aberto diz "a partir de".
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
                    when new.reserva_fim is null then 'a partir de ' || to_char(new.reserva_inicio, 'DD/MM/YYYY') || ', sem data final'
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
