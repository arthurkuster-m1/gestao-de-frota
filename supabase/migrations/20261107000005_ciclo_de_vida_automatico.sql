-- Ciclo de vida automático: a data e o status andam juntos, em qualquer caminho (tabela, cards, janela, importação).
--  * Preencheu uma DATA do marco → o status avança (nunca volta):
--      liberação → Liberado · faturamento (carro "Disponível sem faturamento") → Revisão e emplacamento
--      emplacamento → Pronto (ou Em blindagem, se o carro é blindado) · devolução → Devolvido
--  * Mudou o STATUS para um marco e a data está vazia → a data entra como hoje (fuso de São Paulo):
--      Pedido recebido · Liberado · Pronto (emplacamento) · Devolvido
--  * Mudou o status E a data na mesma gravação → vale o que a pessoa escolheu (nada é automático).
--  * Nunca apaga data, nunca volta status, e não mexe em Gravame, Venda VIP nem Em devolução por causa de data.
-- Idempotente. O histórico (fn_veiculo_historico, migration 0002) já registra o que o gatilho mudar.

create or replace function public.fn_veiculo_ciclo_auto()
returns trigger language plpgsql set search_path = public as $$
declare
  ordem text[] := array['pedido_recebido', 'liberado', 'em_transporte_0km', 'disponivel_sem_faturamento', 'revisao_emplacamento',
                        'em_blindagem', 'disponivel', 'gravame', 'venda_vip', 'em_devolucao', 'devolvido'];
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  status_mudou boolean := (tg_op = 'UPDATE' and new.status_ciclo is distinct from old.status_ciclo);
  pos int := array_position(ordem, new.status_ciclo);
begin
  if status_mudou then
    -- o status foi escolhido: só completa a data do marco, se estiver vazia
    if new.status_ciclo = 'pedido_recebido' and new.data_pedido is null then new.data_pedido := hoje; end if;
    if new.status_ciclo = 'liberado' and new.data_liberacao is null then new.data_liberacao := hoje; end if;
    if new.status_ciclo = 'disponivel' and new.data_emplacamento is null then new.data_emplacamento := hoje; end if;
    if new.status_ciclo = 'devolvido' and new.data_devolucao is null then new.data_devolucao := hoje; end if;
    return new;
  end if;

  -- uma data foi preenchida agora (era vazia): o status acompanha, só para a frente
  if new.data_liberacao is not null and (tg_op = 'INSERT' or old.data_liberacao is null) and pos < array_position(ordem, 'liberado') then
    new.status_ciclo := 'liberado';
  end if;
  pos := array_position(ordem, new.status_ciclo);
  if new.data_faturamento is not null and (tg_op = 'INSERT' or old.data_faturamento is null) and new.status_ciclo = 'disponivel_sem_faturamento' then
    new.status_ciclo := 'revisao_emplacamento';
  end if;
  pos := array_position(ordem, new.status_ciclo);
  if new.data_emplacamento is not null and (tg_op = 'INSERT' or old.data_emplacamento is null) and pos <= array_position(ordem, 'revisao_emplacamento') then
    new.status_ciclo := case when new.blindado then 'em_blindagem' else 'disponivel' end;
  end if;
  if new.data_devolucao is not null and (tg_op = 'INSERT' or old.data_devolucao is null) and new.status_ciclo <> 'devolvido' then
    new.status_ciclo := 'devolvido';
  end if;
  return new;
end $$;

drop trigger if exists veiculos_ciclo_auto on public.veiculos;
create trigger veiculos_ciclo_auto before insert or update on public.veiculos for each row execute function public.fn_veiculo_ciclo_auto();

-- Função nova em public nasce exposta: revoga PUBLIC, anon E authenticated (o Supabase concede os três por padrão).
-- Gatilho não precisa de EXECUTE do usuário (a permissão é conferida só ao criar o gatilho).
-- Aproveita para fechar a função de gatilho da migration 0002, que ficou aberta a authenticated.
revoke execute on function public.fn_veiculo_ciclo_auto() from public, anon, authenticated;
revoke execute on function public.fn_veiculo_historico() from public, anon, authenticated;
