-- Teste da migration 0008 (manutenções). Roda tudo e DESFAZ no fim: "TESTE_OK ..." é o sucesso.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  wa uuid; wb uuid; va uuid; vb uuid; ma uuid; mb uuid; n int; r record;
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (ua, 'a@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (ub, 'b@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.workspaces (name) values ('A') returning id into wa;
  insert into public.workspaces (name) values ('B') returning id into wb;
  insert into public.workspace_members (workspace_id, user_id, display_name) values (wa, ua, 'A'), (wb, ub, 'B');

  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ub::text, true);
  set local role authenticated;
  insert into public.veiculos (modelo) values ('Do B') returning id into vb;
  insert into public.manutencoes (veiculo_id, nome) values (vb, 'Do B') returning id into mb;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;
  insert into public.veiculos (modelo) values ('Do A') returning id into va;
  insert into public.manutencoes (veiculo_id, nome, tipo, data_ocorrencia, data_inicio) values (va, 'Batida na traseira', 'Sinistro', '2026-11-01', '2026-11-03') returning id into ma;
  select * into r from public.manutencoes where id = ma;
  if r.status <> 'solicitar_da' or r.bloqueia_uso is not true then raise exception 'padrões errados: % %', r.status, r.bloqueia_uso; end if;

  -- isolamento
  select count(*) into n from public.manutencoes; if n <> 1 then raise exception 'A enxerga % manutenções (devia ser 1)', n; end if;
  begin insert into public.manutencoes (veiculo_id, nome) values (vb, 'invasão'); raise exception 'A pôs manutenção em carro do B';
  exception when foreign_key_violation then null; end;
  begin insert into public.manutencoes (workspace_id, veiculo_id, nome) values (wb, va, 'invasão'); raise exception 'A criou manutenção no espaço B';
  exception when insufficient_privilege or foreign_key_violation then null; end;
  update public.manutencoes set nome = 'x' where id = mb; get diagnostics n = row_count; if n <> 0 then raise exception 'A ALTEROU manutenção do B'; end if;
  delete from public.manutencoes where id = mb;           get diagnostics n = row_count; if n <> 0 then raise exception 'A APAGOU manutenção do B'; end if;

  -- regras de dado
  begin insert into public.manutencoes (veiculo_id, nome) values (va, '  '); raise exception 'nome vazio passou';
  exception when check_violation then null; end;
  begin update public.manutencoes set status = 'qualquer' where id = ma; raise exception 'status inválido passou';
  exception when check_violation then null; end;
  begin update public.manutencoes set data_fim = '2026-11-02' where id = ma; raise exception 'fim antes do início passou';
  exception when check_violation then null; end;

  -- ficar Pronto sem fim => fim = hoje (nunca antes do início)
  update public.manutencoes set status = 'em_reparo' where id = ma;
  update public.manutencoes set status = 'pronto' where id = ma;
  select * into r from public.manutencoes where id = ma;
  if r.data_fim is null or r.data_fim < r.data_inicio then raise exception 'Pronto devia fechar o fim (%)', r.data_fim; end if;
  -- fim informado à mão vence
  update public.manutencoes set status = 'em_reparo', data_fim = '2026-11-20' where id = ma;
  update public.manutencoes set status = 'pronto' where id = ma;
  select * into r from public.manutencoes where id = ma;
  if r.data_fim <> '2026-11-20' then raise exception 'o fim manual foi sobrescrito (%)', r.data_fim; end if;

  -- histórico do carro: abertura + 4 mudanças de status
  select count(*) into n from public.veiculo_atividades where veiculo_id = va and tipo = 'manutencao';
  if n <> 5 then raise exception 'histórico da manutenção devia ter 5 linhas (tem %)', n; end if;

  -- apagar o carro leva as manutenções junto
  delete from public.veiculos where id = va;
  select count(*) into n from public.manutencoes; if n <> 0 then raise exception 'apagar o carro devia apagar suas manutenções (%)', n; end if;

  reset role;
  if has_function_privilege('authenticated', 'public.fn_manutencao_fecha()', 'execute')
     or has_function_privilege('anon', 'public.fn_manutencao_historico()', 'execute')
     or has_function_privilege('authenticated', 'public.fn_manutencao_historico()', 'execute') then
    raise exception 'função de trigger executável por quem não devia';
  end if;
  set local role anon;
  begin perform 1 from public.manutencoes; raise exception 'anon conseguiu LER manutenções';
  exception when insufficient_privilege then null; end;
  reset role;
  raise exception 'TESTE_OK: manutenções isoladas por espaço, FK composta, checks, fechamento automático, histórico, funções fechadas, anon bloqueado.';
end $$;
