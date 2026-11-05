-- Teste da migration 0004 (visões salvas). Roda tudo e DESFAZ no fim: "TESTE_OK ..." é o sucesso; qualquer outra mensagem é falha.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  wa uuid; wb uuid; va uuid; vb uuid; n int;
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
  insert into public.visoes_salvas (tela, nome, config) values ('veiculos', 'Disponíveis', '{"filtros":[]}') returning id into vb;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;
  insert into public.visoes_salvas (tela, nome, tipo, config) values ('veiculos', 'Disponíveis', 'tabela', '{"filtros":[{"campo":"ciclo","operador":"e","valor":["disponivel"]}]}') returning id into va;  -- mesmo nome do B: não conflita
  select count(*) into n from public.visoes_salvas; if n <> 1 then raise exception 'A enxerga % visões (devia ser 1)', n; end if;
  update public.visoes_salvas set nome = 'x' where id = vb; get diagnostics n = row_count; if n <> 0 then raise exception 'A ALTEROU visão do B'; end if;
  delete from public.visoes_salvas where id = vb;           get diagnostics n = row_count; if n <> 0 then raise exception 'A APAGOU visão do B'; end if;
  begin insert into public.visoes_salvas (workspace_id, tela, nome) values (wb, 'veiculos', 'Invasora'); raise exception 'A criou visão no espaço B';
  exception when insufficient_privilege then null; end;
  begin insert into public.visoes_salvas (tela, nome) values ('veiculos', 'disponíveis'); raise exception 'nome repetido (caixa diferente) passou';
  exception when unique_violation then null; end;
  begin insert into public.visoes_salvas (tela, nome, tipo) values ('veiculos', 'Estranha', 'inventado'); raise exception 'tipo inventado passou';
  exception when check_violation then null; end;
  begin insert into public.visoes_salvas (tela, nome) values ('Tela Errada!', 'x'); raise exception 'tela com formato inválido passou';
  exception when check_violation then null; end;
  begin insert into public.visoes_salvas (tela, nome) values ('veiculos', '   '); raise exception 'nome vazio passou';
  exception when check_violation then null; end;
  begin insert into public.visoes_salvas (tela, nome, config) values ('veiculos', 'Lista', '[1,2]'); raise exception 'config que não é objeto passou';
  exception when check_violation then null; end;
  update public.visoes_salvas set nome = 'Renomeada' where id = va; get diagnostics n = row_count; if n <> 1 then raise exception 'A não conseguiu renomear a própria visão'; end if;

  reset role;
  set local role anon;
  begin perform 1 from public.visoes_salvas; raise exception 'anon conseguiu LER visões';
  exception when insufficient_privilege then null; end;
  reset role;
  raise exception 'TESTE_OK: visões isoladas por espaço, nome único por tela (sem caixa), tipo e formato validados, anon bloqueado.';
end $$;
