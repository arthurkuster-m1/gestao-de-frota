-- Teste da migration 0009 (transportes e pagamentos). Roda tudo e DESFAZ no fim: "TESTE_OK ..." é o sucesso.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  wa uuid; wb uuid; va uuid; ea uuid; eb uuid; ea2 uuid; ra uuid; ra2 uuid; ti uuid; tv uuid; tb uuid; tso uuid; pa uuid; pn uuid; pb uuid; n int; r record;
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
  insert into public.transportes (evento_id, sentido, modalidade, distancia_km) values (eb, 'ida', 'pta', 600) returning id into tb;
  insert into public.pagamentos (tipo, numero) values ('pta', 'B-1') returning id into pb;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;
  insert into public.veiculos (modelo) values ('Do A') returning id into va;
  insert into public.eventos (nome) values ('Convenção') returning id into ea;
  insert into public.eventos (nome) values ('Outro') returning id into ea2;
  insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim) values (ea, va, '2026-11-10', '2026-11-20') returning id into ra;
  insert into public.evento_veiculos (evento_id, veiculo_id, reserva_inicio, reserva_fim) values (ea2, va, '2026-12-10', '2026-12-20') returning id into ra2;

  -- dias de viagem: km ÷ 500 para cima, retirada = 0
  insert into public.transportes (evento_id, sentido, modalidade, distancia_km, referencia, valor_planejado) values (ea, 'ida', 'pta', 3000, 'PTAS00666314', 1500.50) returning id into ti;
  select * into r from public.transportes where id = ti; if r.dias_viagem <> 6 then raise exception '3000 km devia dar 6 dias (%)', r.dias_viagem; end if;
  insert into public.transportes (evento_id, sentido, modalidade, distancia_km) values (ea, 'volta', 'pta', 600) returning id into tv;
  select * into r from public.transportes where id = tv; if r.dias_viagem <> 2 then raise exception '600 km devia dar 2 dias (%)', r.dias_viagem; end if;
  insert into public.transportes (evento_id, sentido, modalidade, distancia_km) values (ea, 'ida', 'retirada', 2000) returning id into tso;
  select * into r from public.transportes where id = tso; if r.dias_viagem <> 0 then raise exception 'retirada devia ter 0 dia (%)', r.dias_viagem; end if;
  update public.transportes set distancia_km = 1001 where id = tv;
  select * into r from public.transportes where id = tv; if r.dias_viagem <> 3 then raise exception 'mudar o km devia recalcular (%)', r.dias_viagem; end if;
  update public.transportes set distancia_km = 100, dias_viagem = 5 where id = tv;
  select * into r from public.transportes where id = tv; if r.dias_viagem <> 5 then raise exception 'ajuste manual dos dias foi sobrescrito (%)', r.dias_viagem; end if;

  -- pagamentos: status por tipo, padrão, data ao pagar, número único
  insert into public.pagamentos (tipo, numero) values ('pta', 'PTAS1') returning id into pa;
  select * into r from public.pagamentos where id = pa; if r.status <> 'solicitado' then raise exception 'PTA nasce Solicitado (%)', r.status; end if;
  insert into public.pagamentos (tipo, numero) values ('nf_tso', 'NF-9') returning id into pn;
  select * into r from public.pagamentos where id = pn; if r.status <> 'orcamento_recebido' then raise exception 'NF nasce Orçamento recebido (%)', r.status; end if;
  begin update public.pagamentos set status = 'pago' where id = pn; raise exception 'NF não tem status Pago';
  exception when check_violation then null; end;
  begin update public.pagamentos set status = 'aprovar_nf' where id = pa; raise exception 'PTA não tem status Aprovar NF';
  exception when check_violation then null; end;
  update public.pagamentos set status = 'pago' where id = pa;
  select * into r from public.pagamentos where id = pa; if r.data_pagamento is null then raise exception 'pago devia preencher a data'; end if;
  begin insert into public.pagamentos (tipo, numero) values ('pta', ' ptas1 '); raise exception 'número repetido passou';
  exception when unique_violation then null; end;
  begin insert into public.pagamentos (tipo, numero, valor_real) values ('pta', 'X', -1); raise exception 'valor negativo passou';
  exception when check_violation then null; end;

  -- pagamento combina com a modalidade
  update public.transportes set pagamento_id = pa where id = ti;
  begin update public.transportes set pagamento_id = pn where id = ti; raise exception 'PTA ligada a NF da TSO passou';
  exception when check_violation then null; end;

  -- reserva aponta para transporte do mesmo evento e do sentido certo
  update public.evento_veiculos set transporte_ida_id = ti, transporte_volta_id = tv where id = ra;
  begin update public.evento_veiculos set transporte_ida_id = tv where id = ra; raise exception 'transporte de volta na ida passou';
  exception when check_violation then null; end;
  begin update public.evento_veiculos set transporte_ida_id = ti where id = ra2; raise exception 'transporte de OUTRO evento passou';
  exception when check_violation then null; end;

  -- isolamento
  select count(*) into n from public.transportes; if n <> 3 then raise exception 'A enxerga % transportes (devia ser 3)', n; end if;
  select count(*) into n from public.pagamentos; if n <> 2 then raise exception 'A enxerga % pagamentos (devia ser 2)', n; end if;
  begin insert into public.transportes (evento_id, sentido, modalidade) values (eb, 'ida', 'pta'); raise exception 'A pôs transporte em evento do B';
  exception when foreign_key_violation then null; end;
  begin update public.transportes set pagamento_id = pb where id = ti; raise exception 'A ligou transporte a pagamento do B';
  exception when foreign_key_violation or check_violation then null; end;
  begin update public.evento_veiculos set transporte_ida_id = tb where id = ra; raise exception 'A ligou reserva a transporte do B';
  exception when foreign_key_violation or check_violation then null; end;
  update public.transportes set referencia = 'x' where id = tb; get diagnostics n = row_count; if n <> 0 then raise exception 'A ALTEROU transporte do B'; end if;
  delete from public.pagamentos where id = pb;                  get diagnostics n = row_count; if n <> 0 then raise exception 'A APAGOU pagamento do B'; end if;

  -- apagar o pagamento solta o transporte; apagar o transporte solta a reserva; apagar o evento leva os transportes
  delete from public.pagamentos where id = pa;
  select * into r from public.transportes where id = ti; if r.pagamento_id is not null or r.workspace_id <> wa then raise exception 'apagar pagamento devia soltar o transporte, sem perder o espaço'; end if;
  delete from public.transportes where id = tv;
  select transporte_volta_id into pa from public.evento_veiculos where id = ra; if pa is not null then raise exception 'apagar transporte devia soltar a reserva'; end if;
  delete from public.eventos where id = ea;
  select count(*) into n from public.transportes; if n <> 0 then raise exception 'apagar evento devia apagar seus transportes (%)', n; end if;

  reset role;
  if has_function_privilege('authenticated', 'public.fn_transporte_regras()', 'execute') or has_function_privilege('anon', 'public.fn_pagamento_preenche()', 'execute')
     or has_function_privilege('authenticated', 'public.fn_reserva_transporte_valida()', 'execute') then raise exception 'função de trigger executável por quem não devia'; end if;
  set local role anon;
  begin perform 1 from public.transportes; raise exception 'anon conseguiu LER transportes';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.pagamentos; raise exception 'anon conseguiu LER pagamentos';
  exception when insufficient_privilege then null; end;
  reset role;
  raise exception 'TESTE_OK: transportes e pagamentos isolados por espaço, dias de viagem (km÷500, retirada 0, ajuste manual vale), status por tipo, vínculos conferidos, exclusões em cascata/soltura, anon bloqueado.';
end $$;
