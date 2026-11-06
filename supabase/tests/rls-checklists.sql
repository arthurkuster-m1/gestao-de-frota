-- Teste da migration 0010 (checklists). Roda tudo e DESFAZ no fim: "TESTE_OK ..." é o sucesso.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  wa uuid; wb uuid; va uuid; vb uuid; ea uuid; eb uuid; ra uuid; rb uuid; ra2 uuid; ea3 uuid; ca uuid; cb uuid; n int; r record;
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
  insert into public.eventos (nome) values ('Do B') returning id into eb;
  insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim) values (eb, vb, '2026-11-10', '2026-11-20') returning id into rb;
  insert into public.checklists (reserva_id, momento, km) values (rb, 'saida', 100) returning id into cb;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;
  insert into public.veiculos (modelo) values ('Do A') returning id into va;
  insert into public.eventos (nome) values ('Convenção') returning id into ea;
  insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim) values (ea, va, '2026-11-10', '2026-11-20') returning id into ra;

  -- saída: cria, põe a reserva em uso, grava histórico
  insert into public.checklists (reserva_id, momento, km, combustivel, limpeza, recebido_por, observacoes) values (ra, 'saida', 12000, 'cheio', 'limpo', 'João', 'tudo certo') returning id into ca;
  select estado into r from public.evento_veiculos where id = ra; if r.estado <> 'em_uso' then raise exception 'saída devia pôr a reserva em uso (%)', r.estado; end if;
  select count(*) into n from public.veiculo_atividades where veiculo_id = va and tipo = 'checklist'; if n <> 1 then raise exception 'histórico do checklist devia ter 1 linha (%)', n; end if;

  -- um de cada momento por reserva
  begin insert into public.checklists (reserva_id, momento) values (ra, 'saida'); raise exception 'segunda saída passou';
  exception when unique_violation then null; end;

  -- regras de dado
  begin insert into public.checklists (reserva_id, momento, teve_avarias) values (ra, 'retorno', true); raise exception 'avaria sem dizer quais passou';
  exception when check_violation then null; end;
  begin insert into public.checklists (reserva_id, momento, teve_avarias, avarias) values (ra, 'retorno', true, '   '); raise exception 'avaria em branco passou';
  exception when check_violation then null; end;
  begin insert into public.checklists (reserva_id, momento, combustivel) values (ra, 'retorno', 'transbordando'); raise exception 'combustível inválido passou';
  exception when check_violation then null; end;
  begin insert into public.checklists (reserva_id, momento, km) values (ra, 'retorno', -5); raise exception 'km negativo passou';
  exception when check_violation then null; end;
  begin insert into public.checklists (reserva_id, momento, km) values (ra, 'retorno', 11000); raise exception 'retorno com km menor que a saída passou';
  exception when check_violation then null; end;

  -- retorno: com avarias e km maior; conclui a reserva
  insert into public.checklists (reserva_id, momento, km, teve_avarias, avarias) values (ra, 'retorno', 12850, true, 'Arranhão no para-choque traseiro');
  select estado into r from public.evento_veiculos where id = ra; if r.estado <> 'concluido' then raise exception 'retorno devia concluir a reserva (%)', r.estado; end if;
  begin update public.checklists set km = 99999 where id = ca; raise exception 'editar a saída para km maior que o retorno passou';
  exception when check_violation then null; end;
  update public.checklists set km = 12010 where id = ca;                       -- editar dentro da regra vale

  -- cancelada não "volta" nem avança por checklist
  insert into public.eventos (nome) values ('Outro evento') returning id into ea3;
  insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim, estado) values (ea3, va, '2026-12-01', '2026-12-05', 'cancelado') returning id into ra2;
  insert into public.checklists (reserva_id, momento) values (ra2, 'saida');
  select estado into r from public.evento_veiculos where id = ra2; if r.estado <> 'cancelado' then raise exception 'checklist reviveu reserva cancelada (%)', r.estado; end if;

  -- isolamento
  select count(*) into n from public.checklists; if n <> 3 then raise exception 'A enxerga % checklists (devia ser 3)', n; end if;
  begin insert into public.checklists (reserva_id, momento) values (rb, 'retorno'); raise exception 'A fez checklist em reserva do B';
  exception when foreign_key_violation then null; end;
  begin insert into public.checklists (workspace_id, reserva_id, momento) values (wb, ra, 'retorno'); raise exception 'A criou checklist no espaço B';
  exception when insufficient_privilege or foreign_key_violation then null; end;
  update public.checklists set km = 1 where id = cb; get diagnostics n = row_count; if n <> 0 then raise exception 'A ALTEROU checklist do B'; end if;
  delete from public.checklists where id = cb;        get diagnostics n = row_count; if n <> 0 then raise exception 'A APAGOU checklist do B'; end if;

  -- apagar a reserva leva os checklists
  delete from public.evento_veiculos where id = ra;
  select count(*) into n from public.checklists where reserva_id = ra; if n <> 0 then raise exception 'apagar reserva devia apagar seus checklists (%)', n; end if;

  reset role;
  if has_function_privilege('authenticated', 'public.fn_checklist_confere()', 'execute') or has_function_privilege('anon', 'public.fn_checklist_efeitos()', 'execute')
     or has_function_privilege('authenticated', 'public.fn_checklist_efeitos()', 'execute') then raise exception 'função de trigger executável por quem não devia'; end if;
  set local role anon;
  begin perform 1 from public.checklists; raise exception 'anon conseguiu LER checklists';
  exception when insufficient_privilege then null; end;
  reset role;
  raise exception 'TESTE_OK: checklists isolados por espaço, saída põe Em uso e retorno conclui (só para a frente, cancelada não revive), km do retorno >= saída, avaria exige descrição, um por momento, histórico, funções fechadas, anon bloqueado.';
end $$;
