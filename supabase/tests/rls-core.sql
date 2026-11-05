-- Teste de isolamento do núcleo. Roda tudo e DESFAZ no fim (nada fica gravado): se passar, termina com o erro
-- "TESTE_OK ..." de propósito (é o jeito de forçar o desfazer); qualquer outra mensagem é uma falha real.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  wa uuid; wb uuid; n int;
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (ua, 'a@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (ub, 'b@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.workspaces (name) values ('A') returning id into wa;
  insert into public.workspaces (name) values ('B') returning id into wb;
  insert into public.workspace_members (workspace_id, user_id, display_name) values (wa, ua, 'A'), (wb, ub, 'B');

  -- logado como A
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;
  select count(*) into n from public.workspaces;        if n <> 1 then raise exception 'A enxerga % espaços (devia ser 1)', n; end if;
  select count(*) into n from public.workspace_members; if n <> 1 then raise exception 'A enxerga % membros (devia ser 1)', n; end if;
  begin insert into public.workspaces (name) values ('invasão'); raise exception 'A conseguiu CRIAR espaço';
  exception when insufficient_privilege then null; end;
  begin insert into public.workspace_members (workspace_id, user_id, display_name) values (wb, ua, 'x'); raise exception 'A conseguiu entrar no espaço B';
  exception when insufficient_privilege then null; end;
  begin update public.workspaces set name = 'x' where id = wb; raise exception 'A conseguiu ALTERAR espaço';
  exception when insufficient_privilege then null; end;
  begin delete from public.workspaces where id = wb; raise exception 'A conseguiu APAGAR espaço';
  exception when insufficient_privilege then null; end;

  -- sem login (anon)
  reset role;
  set local role anon;
  begin perform 1 from public.workspaces; raise exception 'anon conseguiu LER espaços';
  exception when insufficient_privilege then null; end;
  begin perform public.fn_my_workspaces(); raise exception 'anon conseguiu chamar fn_my_workspaces';
  exception when insufficient_privilege then null; end;
  reset role;

  raise exception 'TESTE_OK: A só vê o próprio espaço; ninguém cria, altera, apaga nem entra em outro; anon não lê nada.';
end $$;
