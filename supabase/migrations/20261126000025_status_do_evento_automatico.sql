-- manifest: novo vocabulário de status do evento: Recebido (padrão), Planejado, Solicitar transporte, Envio agendado, Em uso, Solicitar retorno, Retorno solicitado, Concluído.
-- "Envio solicitado" vira "Envio agendado" e "Recebido" entra como status inicial. As mudanças automáticas acontecem no app (regras em lib/eventos/automacaoDeStatus.ts). Idempotente.
do $$
declare c record;
begin
  for c in select conname, conrelid::regclass as tabela from pg_constraint
            where contype = 'c' and conrelid in ('public.eventos'::regclass, 'public.evento_veiculos'::regclass)
              and pg_get_constraintdef(oid) like '%solicitar_transporte%' loop
    execute format('alter table %s drop constraint %I', c.tabela, c.conname);
  end loop;
end $$;
update public.eventos set status = 'envio_agendado' where status = 'envio_solicitado';
update public.evento_veiculos set status_individual = 'envio_agendado' where status_individual = 'envio_solicitado';
alter table public.eventos add constraint eventos_status_check
  check (status in ('recebido', 'planejado', 'solicitar_transporte', 'envio_agendado', 'em_uso', 'solicitar_retorno', 'retorno_solicitado', 'concluido'));
alter table public.evento_veiculos add constraint evento_veiculos_status_individual_check
  check (status_individual is null or status_individual in ('recebido', 'planejado', 'solicitar_transporte', 'envio_agendado', 'em_uso', 'solicitar_retorno', 'retorno_solicitado', 'concluido'));
alter table public.eventos alter column status set default 'recebido';
