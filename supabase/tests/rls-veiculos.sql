-- Teste de isolamento dos VEÍCULOS e do histórico (migration 0002). Clientes, motoristas e locais: rls-dados-confidenciais.sql (migration 0003).
-- Roda tudo e DESFAZ no fim: se passar, termina com o erro "TESTE_OK ..." de propósito; qualquer outra mensagem é falha real.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  wa uuid; wb uuid; va uuid; vb uuid; n int; cod text;
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (ua, 'a@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (ub, 'b@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.workspaces (name) values ('A') returning id into wa;
  insert into public.workspaces (name) values ('B') returning id into wb;
  insert into public.workspace_members (workspace_id, user_id, display_name) values (wa, ua, 'A'), (wb, ub, 'B');

  -- B cria os dele (workspace_id vem do default, não do corpo)
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ub::text, true);
  set local role authenticated;
  insert into public.veiculos (modelo, vin) values ('Onix', '9BGKS48X0NG123456') returning id into vb;
  reset role;

  -- logado como A
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;

  insert into public.veiculos (modelo, vin) values ('Onix', '9BGKS48X0NG123456') returning id, codigo into va, cod;  -- mesmo VIN do B: não conflita (unicidade é por espaço)
  if cod <> 'ONIX 3456' then raise exception 'código calculado errado: %', cod; end if;
  insert into public.veiculos (modelo, versao, vin) values ('S10', 'Trailboss', '9BG1234567N654321') returning codigo into cod;
  if cod <> 'S10 TRAILBOSS 4321' then raise exception 'código com versão errado: %', cod; end if;
  insert into public.veiculos (modelo, versao, vin) values ('Onix', '  ', '9BG1234567N111111') returning codigo into cod;
  if cod <> 'ONIX 1111' then raise exception 'versão em branco devia ser ignorada: %', cod; end if;
  insert into public.veiculos (modelo) values ('Tracker');                                                          -- sem VIN: código vazio
  select count(*) into n from public.veiculos where codigo is null; if n <> 1 then raise exception 'carro sem VIN devia ter código vazio'; end if;

  select count(*) into n from public.veiculos;           if n <> 4 then raise exception 'A enxerga % veículos (devia ser 4)', n; end if;
  select count(*) into n from public.veiculo_atividades where veiculo_id = vb; if n <> 0 then raise exception 'A enxerga histórico de carro do B'; end if;

  -- histórico automático: cadastro + mudança de ciclo + data de faturamento
  update public.veiculos set status_ciclo = 'liberado', data_faturamento = '2026-10-01' where id = va;
  select count(*) into n from public.veiculo_atividades where veiculo_id = va and tipo = 'cadastro';   if n <> 1 then raise exception 'faltou atividade de cadastro (%)', n; end if;
  select count(*) into n from public.veiculo_atividades where veiculo_id = va and tipo = 'ciclo_vida'; if n <> 1 then raise exception 'faltou atividade de ciclo (%)', n; end if;
  select count(*) into n from public.veiculo_atividades where veiculo_id = va and tipo = 'faturamento'; if n <> 1 then raise exception 'faltou atividade de faturamento (%)', n; end if;

  -- A não mexe no que é do B (RLS: update/delete afetam 0 linhas)
  update public.veiculos set cor = 'invasão' where id = vb; get diagnostics n = row_count; if n <> 0 then raise exception 'A ALTEROU carro do B'; end if;
  delete from public.veiculos where id = vb;               get diagnostics n = row_count; if n <> 0 then raise exception 'A APAGOU carro do B'; end if;

  -- A não grava no espaço do B
  begin insert into public.veiculos (workspace_id, modelo) values (wb, 'Invasor'); raise exception 'A criou veículo no espaço B';
  exception when insufficient_privilege then null; end;
  -- nem aponta para filho/pai de outro espaço (FK composta)
  begin insert into public.veiculo_atividades (veiculo_id, tipo, descricao) values (vb, 'x', 'invasão'); raise exception 'A escreveu histórico em carro do B';
  exception when foreign_key_violation then null; end;

  -- histórico só acrescenta
  begin update public.veiculo_atividades set descricao = 'x'; raise exception 'A conseguiu ALTERAR o histórico';
  exception when insufficient_privilege then null; end;
  begin delete from public.veiculo_atividades; raise exception 'A conseguiu APAGAR o histórico';
  exception when insufficient_privilege then null; end;

  -- regras de dado
  begin insert into public.veiculos (modelo, vin) values ('Onix', '9BGKS48X0NG123456'); raise exception 'VIN duplicado passou';
  exception when unique_violation then null; end;
  begin insert into public.veiculos (modelo, vin) values ('X', 'curto'); raise exception 'VIN inválido passou';
  exception when check_violation then null; end;
  begin insert into public.veiculos (modelo, status_ciclo) values ('X', 'inventado'); raise exception 'status inventado passou';
  exception when check_violation then null; end;

  -- sem login (anon)
  reset role;
  set local role anon;
  begin perform 1 from public.veiculos; raise exception 'anon conseguiu LER veículos';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.veiculo_atividades; raise exception 'anon conseguiu LER histórico';
  exception when insufficient_privilege then null; end;
  reset role;

  raise exception 'TESTE_OK: veículos isolados entre espaços, histórico só acrescenta, FK não cruza espaços, regras de dado e anon bloqueado.';
end $$;
