-- Teste da migration 0011 (contratos e aditivos). Roda tudo e DESFAZ no fim: "TESTE_OK ..." é o sucesso.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  wa uuid; wb uuid; va uuid; va2 uuid; vb uuid; ea uuid; ea2 uuid; eb uuid; cla uuid; clb uuid; ka uuid; kb uuid; ad uuid; ad2 uuid; n int; r record;
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (ua, 'a@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (ub, 'b@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.workspaces (name) values ('A') returning id into wa;
  insert into public.workspaces (name) values ('B') returning id into wb;
  insert into public.workspace_members (workspace_id, user_id, display_name) values (wa, ua, 'A'), (wb, ub, 'B');
  -- clientes só nascem pelas funções do banco (dados confidenciais); aqui o dono do banco cria direto
  insert into public.clientes (workspace_id, nome) values (wa, 'Cliente A') returning id into cla;
  insert into public.clientes (workspace_id, nome) values (wb, 'Cliente B') returning id into clb;

  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ub::text, true);
  set local role authenticated;
  insert into public.veiculos (modelo) values ('Do B') returning id into vb;
  insert into public.eventos (nome) values ('Do B') returning id into eb;
  insert into public.contratos_comodato (evento_id, cliente_id) values (eb, clb) returning id into kb;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;
  insert into public.veiculos (modelo) values ('Do A') returning id into va;
  insert into public.veiculos (modelo) values ('Do A 2') returning id into va2;
  insert into public.eventos (nome) values ('Convenção') returning id into ea;
  insert into public.eventos (nome) values ('Outro') returning id into ea2;

  insert into public.contratos_comodato (evento_id, cliente_id, vigencia_inicio, vigencia_fim) values (ea, cla, '2026-11-10', '2026-11-20') returning id into ka;
  select * into r from public.contratos_comodato where id = ka; if r.status <> 'rascunho' then raise exception 'contrato nasce Rascunho (%)', r.status; end if;
  insert into public.contrato_veiculos (contrato_id, veiculo_id) values (ka, va);

  -- um contrato por evento; carro uma vez por contrato
  begin insert into public.contratos_comodato (evento_id, cliente_id) values (ea, cla); raise exception 'segundo contrato do mesmo evento passou';
  exception when unique_violation then null; end;
  begin insert into public.contrato_veiculos (contrato_id, veiculo_id) values (ka, va); raise exception 'carro repetido no contrato passou';
  exception when unique_violation then null; end;

  -- regras de dado
  begin update public.contratos_comodato set vigencia_fim = '2026-11-01' where id = ka; raise exception 'vigência com fim antes do início passou';
  exception when check_violation then null; end;
  begin update public.contratos_comodato set status = 'qualquer' where id = ka; raise exception 'status inválido passou';
  exception when check_violation then null; end;
  update public.contratos_comodato set status = 'assinado' where id = ka;
  select * into r from public.contratos_comodato where id = ka; if r.assinado_em is null then raise exception 'Assinado devia preencher a data'; end if;

  -- aditivos
  begin insert into public.contrato_aditivos (contrato_id, tipo) values (ka, 'extensao_prazo'); raise exception 'extensão sem nova data passou';
  exception when check_violation then null; end;
  begin insert into public.contrato_aditivos (contrato_id, tipo) values (ka, 'outro'); raise exception 'tipo de aditivo inválido passou';
  exception when check_violation then null; end;
  insert into public.contrato_aditivos (contrato_id, tipo, vigencia_fim_anterior, vigencia_fim_nova, motivo) values (ka, 'extensao_prazo', '2026-11-20', '2026-12-05', 'Cliente pediu mais prazo') returning id into ad;
  insert into public.contrato_aditivos (contrato_id, tipo) values (ka, 'troca_carros') returning id into ad2;
  insert into public.contrato_aditivo_veiculos (aditivo_id, veiculo_id, acao) values (ad2, va, 'sai'), (ad2, va2, 'entra');
  begin insert into public.contrato_aditivo_veiculos (aditivo_id, veiculo_id, acao) values (ad2, va, 'entra'); raise exception 'carro duas vezes no mesmo aditivo passou';
  exception when unique_violation then null; end;
  begin insert into public.contrato_aditivo_veiculos (aditivo_id, veiculo_id, acao) values (ad2, va, 'troca'); raise exception 'ação inválida passou';
  exception when check_violation or unique_violation then null; end;
  update public.contrato_aditivos set status = 'assinado' where id = ad;
  select * into r from public.contrato_aditivos where id = ad; if r.assinado_em is null then raise exception 'aditivo Assinado devia preencher a data'; end if;

  -- isolamento
  select count(*) into n from public.contratos_comodato; if n <> 1 then raise exception 'A enxerga % contratos (devia ser 1)', n; end if;
  begin insert into public.contratos_comodato (evento_id, cliente_id) values (eb, cla); raise exception 'A fez contrato em evento do B';
  exception when foreign_key_violation then null; end;
  begin insert into public.contratos_comodato (evento_id, cliente_id) values (ea2, clb); raise exception 'A usou cliente do B';
  exception when foreign_key_violation then null; end;
  begin insert into public.contrato_veiculos (contrato_id, veiculo_id) values (ka, vb); raise exception 'A pôs carro do B no contrato';
  exception when foreign_key_violation then null; end;
  begin insert into public.contrato_veiculos (contrato_id, veiculo_id) values (kb, va); raise exception 'A mexeu em contrato do B';
  exception when foreign_key_violation then null; end;
  begin insert into public.contratos_comodato (workspace_id, evento_id, cliente_id) values (wb, ea2, cla); raise exception 'A criou contrato no espaço B';
  exception when insufficient_privilege or foreign_key_violation then null; end;
  update public.contratos_comodato set observacoes = 'x' where id = kb; get diagnostics n = row_count; if n <> 0 then raise exception 'A ALTEROU contrato do B'; end if;
  delete from public.contratos_comodato where id = kb;                  get diagnostics n = row_count; if n <> 0 then raise exception 'A APAGOU contrato do B'; end if;

  -- não apaga evento nem cliente que tem contrato
  begin delete from public.eventos where id = ea; raise exception 'apagou evento com contrato';
  exception when foreign_key_violation then null; end;
  begin delete from public.clientes where id = cla; raise exception 'apagou cliente com contrato';
  exception when foreign_key_violation then null; end;

  -- apagar o contrato leva carros, aditivos e carros dos aditivos
  delete from public.contratos_comodato where id = ka;
  select (select count(*) from public.contrato_veiculos) + (select count(*) from public.contrato_aditivos) + (select count(*) from public.contrato_aditivo_veiculos) into n;
  if n <> 0 then raise exception 'apagar contrato devia levar tudo (%)', n; end if;

  reset role;
  if has_function_privilege('authenticated', 'public.fn_contrato_assinatura()', 'execute') or has_function_privilege('anon', 'public.fn_contrato_assinatura()', 'execute') then raise exception 'função de trigger executável por quem não devia'; end if;
  set local role anon;
  begin perform 1 from public.contratos_comodato; raise exception 'anon conseguiu LER contratos';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.contrato_aditivos; raise exception 'anon conseguiu LER aditivos';
  exception when insufficient_privilege then null; end;
  reset role;
  raise exception 'TESTE_OK: contratos e aditivos isolados por espaço, um contrato por evento, vigência e status conferidos, extensão exige nova data, assinatura preenche a data, evento e cliente com contrato não se apagam, cascata ao apagar o contrato, anon bloqueado.';
end $$;
