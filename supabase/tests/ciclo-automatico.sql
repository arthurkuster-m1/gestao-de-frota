-- Teste da migration 0005 (ciclo de vida automático). Roda tudo e DESFAZ no fim: "TESTE_OK ..." é o sucesso.
do $$
declare
  ua uuid := gen_random_uuid(); wa uuid; v uuid; r record;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  n int;
begin
  insert into auth.users (id, email, instance_id, aud, role) values (ua, 'a@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.workspaces (name) values ('A') returning id into wa;
  insert into public.workspace_members (workspace_id, user_id, display_name) values (wa, ua, 'A');
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;

  -- data → status (para a frente)
  insert into public.veiculos (modelo) values ('Onix') returning id into v;
  update public.veiculos set data_liberacao = '2026-10-01' where id = v;
  select * into r from public.veiculos where id = v; if r.status_ciclo <> 'liberado' then raise exception 'liberação devia levar a Liberado: %', r.status_ciclo; end if;

  update public.veiculos set status_ciclo = 'disponivel_sem_faturamento' where id = v;
  update public.veiculos set data_faturamento = '2026-10-10' where id = v;
  select * into r from public.veiculos where id = v; if r.status_ciclo <> 'revisao_emplacamento' then raise exception 'faturamento (sem faturamento) devia levar a Revisão e emplacamento: %', r.status_ciclo; end if;

  update public.veiculos set data_emplacamento = '2026-10-20' where id = v;
  select * into r from public.veiculos where id = v; if r.status_ciclo <> 'disponivel' then raise exception 'emplacamento devia levar a Pronto: %', r.status_ciclo; end if;

  update public.veiculos set data_devolucao = '2027-01-10' where id = v;
  select * into r from public.veiculos where id = v; if r.status_ciclo <> 'devolvido' then raise exception 'devolução devia levar a Devolvido: %', r.status_ciclo; end if;

  -- blindado: emplacamento leva a Em blindagem
  insert into public.veiculos (modelo, blindado, status_ciclo) values ('Blindado', true, 'revisao_emplacamento') returning id into v;
  update public.veiculos set data_emplacamento = '2026-10-20' where id = v;
  select * into r from public.veiculos where id = v; if r.status_ciclo <> 'em_blindagem' then raise exception 'blindado devia ir a Em blindagem: %', r.status_ciclo; end if;

  -- nunca volta: carro já Pronto + data de liberação nova não muda o status
  insert into public.veiculos (modelo, status_ciclo) values ('Pronto', 'disponivel') returning id into v;
  update public.veiculos set data_liberacao = '2026-10-01' where id = v;
  select * into r from public.veiculos where id = v; if r.status_ciclo <> 'disponivel' then raise exception 'status voltou para trás: %', r.status_ciclo; end if;
  -- gravame não é movido por data de faturamento/emplacamento
  insert into public.veiculos (modelo, status_ciclo) values ('Travado', 'gravame') returning id into v;
  update public.veiculos set data_faturamento = '2026-10-01', data_emplacamento = '2026-10-02' where id = v;
  select * into r from public.veiculos where id = v; if r.status_ciclo <> 'gravame' then raise exception 'gravame foi movido por data: %', r.status_ciclo; end if;
  -- faturar antes do transporte NÃO move o carro (pode faturar antes de chegar ao CTS)
  insert into public.veiculos (modelo, status_ciclo) values ('Faturado cedo', 'em_transporte_0km') returning id into v;
  update public.veiculos set data_faturamento = '2026-10-01' where id = v;
  select * into r from public.veiculos where id = v; if r.status_ciclo <> 'em_transporte_0km' then raise exception 'faturamento antecipado moveu o carro: %', r.status_ciclo; end if;

  -- status → data (hoje, fuso de SP), só se a data estiver vazia
  insert into public.veiculos (modelo) values ('Status') returning id into v;
  update public.veiculos set status_ciclo = 'liberado' where id = v;
  select * into r from public.veiculos where id = v; if r.data_liberacao is distinct from hoje then raise exception 'status Liberado devia preencher a data com hoje: %', r.data_liberacao; end if;
  update public.veiculos set status_ciclo = 'disponivel' where id = v;
  select * into r from public.veiculos where id = v; if r.data_emplacamento is distinct from hoje then raise exception 'status Pronto devia preencher o emplacamento com hoje'; end if;
  update public.veiculos set status_ciclo = 'devolvido' where id = v;
  select * into r from public.veiculos where id = v; if r.data_devolucao is distinct from hoje then raise exception 'status Devolvido devia preencher a devolução com hoje'; end if;
  -- data já preenchida não é sobrescrita
  insert into public.veiculos (modelo, data_liberacao) values ('Data antiga', '2026-01-01') returning id into v;
  update public.veiculos set status_ciclo = 'em_transporte_0km' where id = v; update public.veiculos set status_ciclo = 'liberado' where id = v;
  select * into r from public.veiculos where id = v; if r.data_liberacao <> '2026-01-01' then raise exception 'data existente foi sobrescrita: %', r.data_liberacao; end if;

  -- escolher status E data na mesma gravação: vale o que a pessoa escolheu
  insert into public.veiculos (modelo) values ('Manual') returning id into v;
  update public.veiculos set status_ciclo = 'em_transporte_0km', data_liberacao = '2026-02-02' where id = v;
  select * into r from public.veiculos where id = v; if r.status_ciclo <> 'em_transporte_0km' or r.data_liberacao <> '2026-02-02' then raise exception 'escolha manual foi alterada: % %', r.status_ciclo, r.data_liberacao; end if;

  -- importação (INSERT) já nasce coerente
  insert into public.veiculos (modelo, data_liberacao, data_faturamento) values ('Importado', '2026-03-01', '2026-03-02') returning id into v;
  select * into r from public.veiculos where id = v; if r.status_ciclo <> 'liberado' then raise exception 'INSERT com data de liberação devia nascer Liberado: %', r.status_ciclo; end if;

  -- o histórico registra a mudança automática
  insert into public.veiculos (modelo) values ('Histórico') returning id into v;
  update public.veiculos set data_liberacao = '2026-10-01' where id = v;
  select count(*) into n from public.veiculo_atividades where veiculo_id = v and tipo = 'ciclo_vida'; if n <> 1 then raise exception 'a mudança automática de status não entrou no histórico (%)', n; end if;

  -- a função de gatilho não pode ficar exposta a quem está logado nem a anon (confere as permissões, não uma chamada)
  reset role;
  if has_function_privilege('authenticated', 'public.fn_veiculo_ciclo_auto()', 'execute') then raise exception 'authenticated pode executar fn_veiculo_ciclo_auto'; end if;
  if has_function_privilege('anon', 'public.fn_veiculo_ciclo_auto()', 'execute') then raise exception 'anon pode executar fn_veiculo_ciclo_auto'; end if;
  raise exception 'TESTE_OK: data e status andam juntos (só para a frente), status preenche a data com hoje, escolha manual é respeitada, gravame não é movido, histórico registra.';
end $$;
