-- Teste da migration 0007 (chegada/retirada e locais do evento). Roda tudo e DESFAZ no fim: "TESTE_OK ..." é o sucesso.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  wa uuid; wb uuid; va uuid; ea uuid; eb uuid; ra uuid; la uuid; n int;
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
  insert into public.eventos (nome) values ('Do B') returning id into eb;
  insert into public.evento_locais (evento_id, endereco) values (eb, 'Rua do B, 1');
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;
  insert into public.veiculos (modelo) values ('Do A') returning id into va;
  insert into public.eventos (nome) values ('Convenção') returning id into ea;
  insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim, chegada, retirada) values (ea, va, '2026-11-10', '2026-11-20', '2026-11-12', '2026-11-18') returning id into ra;

  -- locais: vários por evento, digitados
  insert into public.evento_locais (evento_id, rotulo, endereco, cidade, estado, posicao) values (ea, 'Estande', 'Av. Paulista, 1000', 'São Paulo', 'SP', 0) returning id into la;
  insert into public.evento_locais (evento_id, endereco, posicao) values (ea, 'Rua Augusta, 50', 1);
  select count(*) into n from public.evento_locais; if n <> 2 then raise exception 'A enxerga % locais (devia ser 2)', n; end if;

  -- isolamento
  begin insert into public.evento_locais (evento_id, endereco) values (eb, 'invasão'); raise exception 'A pôs local em evento do B';
  exception when foreign_key_violation then null; end;
  begin insert into public.evento_locais (workspace_id, evento_id, endereco) values (wb, ea, 'invasão'); raise exception 'A criou local no espaço B';
  exception when insufficient_privilege or foreign_key_violation then null; end;
  update public.evento_locais set endereco = 'x' where evento_id = eb; get diagnostics n = row_count; if n <> 0 then raise exception 'A ALTEROU local do B'; end if;
  delete from public.evento_locais where evento_id = eb;              get diagnostics n = row_count; if n <> 0 then raise exception 'A APAGOU local do B'; end if;

  -- regras de dado dos locais
  begin insert into public.evento_locais (evento_id, endereco) values (ea, '   '); raise exception 'endereço vazio passou';
  exception when check_violation then null; end;
  begin insert into public.evento_locais (evento_id, endereco, estado) values (ea, 'Rua X', 'sp'); raise exception 'UF minúscula passou';
  exception when check_violation then null; end;

  -- chegada/retirada: dentro do período da reserva e em ordem
  begin update public.evento_veiculos set chegada = '2026-11-05' where id = ra; raise exception 'chegada antes do início da reserva passou';
  exception when check_violation then null; end;
  begin update public.evento_veiculos set retirada = '2026-11-25' where id = ra; raise exception 'retirada depois do fim da reserva passou';
  exception when check_violation then null; end;
  begin update public.evento_veiculos set chegada = '2026-11-19' where id = ra; raise exception 'chegada depois da retirada passou';
  exception when check_violation then null; end;
  update public.evento_veiculos set chegada = null, retirada = null where id = ra;     -- opcionais: dá para limpar

  -- apagar o evento leva os locais junto
  delete from public.eventos where id = ea;
  select count(*) into n from public.evento_locais; if n <> 0 then raise exception 'apagar evento devia apagar seus locais (%)', n; end if;

  reset role;
  set local role anon;
  begin perform 1 from public.evento_locais; raise exception 'anon conseguiu LER locais do evento';
  exception when insufficient_privilege then null; end;
  reset role;
  raise exception 'TESTE_OK: chegada/retirada dentro da reserva e em ordem, locais do evento (vários, digitados) isolados por espaço e apagados com o evento, anon bloqueado.';
end $$;
