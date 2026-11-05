-- Teste da migration 0006 (eventos e reservas). Roda tudo e DESFAZ no fim: "TESTE_OK ..." é o sucesso.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  wa uuid; wb uuid; va uuid; vb uuid; ea uuid; eb uuid; ra uuid; n int; t text;
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
  insert into public.eventos (nome) values ('Tesouraria') returning id into eb;
  insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim) values (eb, vb, '2026-11-04', '2026-11-05');
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;
  insert into public.veiculos (modelo) values ('Do A') returning id into va;
  insert into public.eventos (nome, tipo) values ('Tesouraria', 'Evento') returning id into ea;      -- mesmo nome do B: não conflita
  insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim) values (ea, va, '2026-11-07', '2026-11-12') returning id into ra;

  select count(*) into n from public.eventos; if n <> 1 then raise exception 'A enxerga % eventos (devia ser 1)', n; end if;
  select count(*) into n from public.evento_veiculos; if n <> 1 then raise exception 'A enxerga % reservas (devia ser 1)', n; end if;
  update public.eventos set nome = 'x' where id = eb; get diagnostics n = row_count; if n <> 0 then raise exception 'A ALTEROU evento do B'; end if;
  delete from public.eventos where id = eb;           get diagnostics n = row_count; if n <> 0 then raise exception 'A APAGOU evento do B'; end if;
  begin insert into public.eventos (workspace_id, nome) values (wb, 'Invasor'); raise exception 'A criou evento no espaço B';
  exception when insufficient_privilege then null; end;
  -- reserva não cruza espaços (FK composta)
  begin insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim) values (eb, va, '2026-11-01', '2026-11-02'); raise exception 'A reservou em evento do B';
  exception when foreign_key_violation then null; end;
  begin insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim) values (ea, vb, '2026-11-01', '2026-11-02'); raise exception 'A reservou carro do B';
  exception when foreign_key_violation then null; end;

  -- regras de dado
  begin insert into public.eventos (nome) values ('tesouraria'); raise exception 'nome repetido (caixa diferente) passou';
  exception when unique_violation then null; end;
  begin insert into public.eventos (nome, status) values ('Inventado', 'xyz'); raise exception 'status de evento inventado passou';
  exception when check_violation then null; end;
  begin insert into public.eventos (nome) values ('   '); raise exception 'nome vazio passou';
  exception when check_violation then null; end;
  begin insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim) values (ea, va, '2026-12-10', '2026-12-01'); raise exception 'fim antes do início passou';
  exception when check_violation or unique_violation then null; end;
  insert into public.eventos (nome) values ('Outro') returning id into eb;
  begin insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim, estado) values (eb, va, '2026-12-01', '2026-12-02', 'inventado'); raise exception 'estado inventado passou';
  exception when check_violation then null; end;
  begin insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim) values (ea, va, '2026-12-01', '2026-12-02'); raise exception 'o mesmo carro duas vezes no mesmo evento passou';
  exception when unique_violation then null; end;
  -- um carro pode ter várias reservas em eventos diferentes
  insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim) values (eb, va, '2026-12-01', '2026-12-02');
  select count(*) into n from public.evento_veiculos where veiculo_id = va; if n <> 2 then raise exception 'carro devia ter 2 reservas, tem %', n; end if;

  -- histórico do carro: reserva criada + mudança de estado
  select count(*) into n from public.veiculo_atividades where veiculo_id = va and tipo = 'reserva'; if n <> 2 then raise exception 'faltou histórico de reserva (%)', n; end if;
  update public.evento_veiculos set estado = 'em_uso' where id = ra;
  select descricao into t from public.veiculo_atividades where veiculo_id = va and tipo = 'uso'; if t is null or t not like '%Tesouraria: em uso%' then raise exception 'histórico de uso errado: %', t; end if;
  update public.evento_veiculos set reserva_fim = '2026-11-13' where id = ra;
  select count(*) into n from public.veiculo_atividades where veiculo_id = va and tipo = 'uso'; if n <> 1 then raise exception 'mudar só a data não devia registrar uso (%)', n; end if;

  -- apagar o evento leva as reservas junto
  delete from public.eventos where id = eb;
  select count(*) into n from public.evento_veiculos where veiculo_id = va; if n <> 1 then raise exception 'apagar evento devia apagar suas reservas (%)', n; end if;

  reset role;
  -- as duas ligações da reserva têm de incluir o espaço de trabalho (outra camada, a do histórico do carro, mascararia a falta)
  select count(*) into n from pg_constraint where conrelid = 'public.evento_veiculos'::regclass and contype = 'f' and pg_get_constraintdef(oid) like 'FOREIGN KEY (veiculo_id, workspace_id) REFERENCES veiculos(id, workspace_id)%';
  if n <> 1 then raise exception 'a reserva perdeu a FK composta com o veículo (veiculo_id, workspace_id)'; end if;
  select count(*) into n from pg_constraint where conrelid = 'public.evento_veiculos'::regclass and contype = 'f' and pg_get_constraintdef(oid) like 'FOREIGN KEY (evento_id, workspace_id) REFERENCES eventos(id, workspace_id)%';
  if n <> 1 then raise exception 'a reserva perdeu a FK composta com o evento (evento_id, workspace_id)'; end if;
  if has_function_privilege('authenticated', 'public.fn_reserva_historico()', 'execute') or has_function_privilege('anon', 'public.fn_reserva_historico()', 'execute') then raise exception 'fn_reserva_historico exposta'; end if;
  set local role anon;
  begin perform 1 from public.eventos; raise exception 'anon conseguiu LER eventos';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.evento_veiculos; raise exception 'anon conseguiu LER reservas';
  exception when insufficient_privilege then null; end;
  reset role;
  raise exception 'TESTE_OK: eventos e reservas isolados por espaço, FKs não cruzam espaços, regras de dado, histórico do carro e anon bloqueado.';
end $$;
