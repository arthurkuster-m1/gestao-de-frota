-- manifest: remove o status "Revisão e emplacamento" do ciclo de vida (era igual a "Disponível sem faturamento") e passa a medir os prazos da placa
-- com duas datas novas no veículo: "Chegou na planta" e "Placas solicitadas". Idempotente.
alter table public.veiculos add column if not exists data_chegada_planta date;
alter table public.veiculos add column if not exists data_placas_solicitadas date;

update public.veiculos set status_ciclo = 'disponivel_sem_faturamento' where status_ciclo = 'revisao_emplacamento';
alter table public.veiculos drop constraint if exists veiculos_status_ciclo_check;
alter table public.veiculos add constraint veiculos_status_ciclo_check check (status_ciclo in (
  'pedido_recebido', 'liberado', 'em_transporte_0km', 'disponivel_sem_faturamento', 'em_blindagem', 'disponivel', 'gravame', 'venda_vip', 'em_devolucao', 'devolvido'));

-- Ciclo automático: data e status andam juntos (só para a frente). Novidades: a data "Chegou na planta" leva a Disponível sem faturamento e,
-- ao escolher esse status sem data, a data entra como hoje; o faturamento NÃO muda mais o ciclo; o emplacamento leva a Pronto (ou Em blindagem).
create or replace function public.fn_veiculo_ciclo_auto()
returns trigger language plpgsql set search_path = public as $$
declare
  ordem text[] := array['pedido_recebido', 'liberado', 'em_transporte_0km', 'disponivel_sem_faturamento',
                        'em_blindagem', 'disponivel', 'gravame', 'venda_vip', 'em_devolucao', 'devolvido'];
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  status_mudou boolean := (tg_op = 'UPDATE' and new.status_ciclo is distinct from old.status_ciclo);
  pos int := array_position(ordem, new.status_ciclo);
begin
  if status_mudou then
    if new.status_ciclo = 'pedido_recebido' and new.data_pedido is null then new.data_pedido := hoje; end if;
    if new.status_ciclo = 'liberado' and new.data_liberacao is null then new.data_liberacao := hoje; end if;
    if new.status_ciclo = 'disponivel_sem_faturamento' and new.data_chegada_planta is null then new.data_chegada_planta := hoje; end if;
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
  if new.data_emplacamento is not null and (tg_op = 'INSERT' or old.data_emplacamento is null) and pos <= array_position(ordem, 'disponivel_sem_faturamento') then
    new.status_ciclo := case when new.blindado then 'em_blindagem' else 'disponivel' end;
  end if;
  if new.data_devolucao is not null and (tg_op = 'INSERT' or old.data_devolucao is null) and new.status_ciclo <> 'devolvido' then
    new.status_ciclo := 'devolvido';
  end if;
  return new;
end $$;

-- Histórico do carro: as duas datas novas também viram linhas do histórico.
create or replace function public.fn_veiculo_historico()
returns trigger language plpgsql set search_path = public as $$
declare r record;
begin
  if tg_op = 'INSERT' then
    insert into public.veiculo_atividades (workspace_id, veiculo_id, tipo, descricao)
    values (new.workspace_id, new.id, 'cadastro', 'Veículo cadastrado (' || new.status_ciclo || ')');
  else
    if new.status_ciclo is distinct from old.status_ciclo then
      insert into public.veiculo_atividades (workspace_id, veiculo_id, tipo, descricao)
      values (new.workspace_id, new.id, 'ciclo_vida', 'Ciclo de vida: ' || old.status_ciclo || ' → ' || new.status_ciclo);
    end if;
    for r in
      select * from (values
        ('pedido_recebido', 'Pedido recebido', old.data_pedido, new.data_pedido),
        ('liberacao', 'Liberado', old.data_liberacao, new.data_liberacao),
        ('chegada_planta', 'Chegou na planta', old.data_chegada_planta, new.data_chegada_planta),
        ('faturamento', 'Faturado', old.data_faturamento, new.data_faturamento),
        ('placas_solicitadas', 'Placas solicitadas', old.data_placas_solicitadas, new.data_placas_solicitadas),
        ('emplacamento', 'Emplacado', old.data_emplacamento, new.data_emplacamento),
        ('devolucao', 'Devolvido', old.data_devolucao, new.data_devolucao)
      ) as t(tipo, rotulo, antes, depois) where depois is distinct from antes and depois is not null
    loop
      insert into public.veiculo_atividades (workspace_id, veiculo_id, tipo, ocorreu_em, descricao)
      values (new.workspace_id, new.id, r.tipo, r.depois::timestamptz, r.rotulo || ' em ' || to_char(r.depois, 'DD/MM/YYYY'));
    end loop;
  end if;
  return null;
end $$;
revoke execute on function public.fn_veiculo_ciclo_auto() from public, anon, authenticated;
revoke execute on function public.fn_veiculo_historico() from public, anon, authenticated;
