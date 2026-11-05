-- Teste da migration 0003 (dados confidenciais criptografados) + isolamento de clientes, motoristas e locais.
-- Roda tudo e DESFAZ no fim: se passar, termina com o erro "TESTE_OK ..." de propósito; qualquer outra mensagem é falha real.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  wa uuid; wb uuid; ca uuid; cb uuid; la uuid; lb uuid; n int; j jsonb; t text; bruto text;
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (ua, 'a@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (ub, 'b@teste.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.workspaces (name) values ('A') returning id into wa;
  insert into public.workspaces (name) values ('B') returning id into wb;
  insert into public.workspace_members (workspace_id, user_id, display_name) values (wa, ua, 'A'), (wb, ub, 'B');

  -- B cria os dele
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ub::text, true);
  set local role authenticated;
  cb := public.fn_cliente_salvar(null, '{"nome":"Empresa B","tipo_pessoa":"juridica","documento":"12.345.678/0001-99","email":"b@empresa.com"}'::jsonb);
  lb := public.fn_local_salvar(null, '{"nome":"CTS B","contato_telefone":"11 90000-0002"}'::jsonb);
  reset role;

  -- logado como A
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;

  -- o mesmo CNPJ em OUTRO espaço não conflita (unicidade é por espaço)
  ca := public.fn_cliente_salvar(null,
    '{"nome":"Empresa A","tipo_pessoa":"juridica","documento":"12.345.678/0001-99","email":"a@empresa.com","testemunha_nome":"Ana","testemunha_email":"ana@x.com","cidade":"São Paulo","estado":"sp"}'::jsonb,
    '[{"nome":"Fulano","cpf":"123.456.789-01","cnh_registro":"0123456789","cnh_validade":"2030-05-01"},{"nome":"Beltrana","cpf":"98765432100"}]'::jsonb);
  la := public.fn_local_salvar(null, '{"nome":"CTS A","contato_nome":"Chico","contato_telefone":"11 90000-0001","contato_email":"chico@cts.com"}'::jsonb);

  -- A lê de volta o que gravou (decifrado), só dele
  j := public.fn_cliente_sensiveis(ca);
  if j ->> 'documento' <> '12345678000199' or j ->> 'email' <> 'a@empresa.com' or j ->> 'testemunha_email' <> 'ana@x.com' then raise exception 'não leu de volta os dados do cliente: %', j; end if;
  select count(*) into n from public.fn_cliente_motoristas(ca); if n <> 2 then raise exception 'A vê % motoristas (devia ser 2)', n; end if;
  select cpf into t from public.fn_cliente_motoristas(ca) where nome = 'Fulano'; if t <> '12345678901' then raise exception 'CPF do motorista não voltou: %', t; end if;
  select cnh_validade into t from public.fn_cliente_motoristas(ca) where nome = 'Fulano'; if t <> '2030-05-01' then raise exception 'validade da CNH não voltou: %', t; end if;
  if public.fn_local_contato(la) ->> 'contato_telefone' <> '11 90000-0001' then raise exception 'telefone do local não voltou'; end if;
  select estado into t from public.clientes where id = ca; if t <> 'SP' then raise exception 'estado devia ser SP: %', t; end if;

  select count(*) into n from public.clientes; if n <> 1 then raise exception 'A enxerga % clientes (devia ser 1)', n; end if;
  select count(*) into n from public.locais;   if n <> 1 then raise exception 'A enxerga % locais (devia ser 1)', n; end if;
  select count(*) into n from public.cliente_motoristas; if n <> 2 then raise exception 'A enxerga % motoristas na tabela (devia ser 2)', n; end if;

  -- A não alcança nada do B, nem pelas funções
  begin perform public.fn_cliente_sensiveis(cb); raise exception 'A leu dados confidenciais do cliente do B';
  exception when insufficient_privilege then null; end;
  begin perform public.fn_local_contato(lb); raise exception 'A leu contato do local do B';
  exception when insufficient_privilege then null; end;
  select count(*) into n from public.fn_cliente_motoristas(cb); if n <> 0 then raise exception 'A enxerga motoristas do cliente do B'; end if;
  begin perform public.fn_cliente_salvar(cb, '{"nome":"invasão"}'::jsonb); raise exception 'A ALTEROU cliente do B';
  exception when insufficient_privilege then null; end;
  begin perform public.fn_cliente_salvar(cb, '{"nome":"invasão"}'::jsonb, '[{"nome":"Invasor"}]'::jsonb); raise exception 'A pôs motorista em cliente do B';
  exception when insufficient_privilege then null; end;
  begin perform public.fn_local_salvar(lb, '{"nome":"invasão"}'::jsonb); raise exception 'A ALTEROU local do B';
  exception when insufficient_privilege then null; end;
  delete from public.clientes where id = cb; get diagnostics n = row_count; if n <> 0 then raise exception 'A APAGOU cliente do B'; end if;

  -- o app não toca nas colunas criptografadas, nem escreve direto nas tabelas
  begin perform sensiveis from public.clientes; raise exception 'A conseguiu LER a coluna criptografada de clientes';
  exception when insufficient_privilege then null; end;
  begin perform sensiveis from public.cliente_motoristas; raise exception 'A conseguiu LER a coluna criptografada de motoristas';
  exception when insufficient_privilege then null; end;
  begin perform documento_hash from public.clientes; raise exception 'A conseguiu LER o índice do documento';
  exception when insufficient_privilege then null; end;
  begin insert into public.clientes (nome) values ('direto'); raise exception 'A inseriu cliente direto na tabela';
  exception when insufficient_privilege then null; end;
  begin update public.clientes set nome = 'x' where id = ca; raise exception 'A atualizou cliente direto na tabela';
  exception when insufficient_privilege then null; end;
  begin insert into public.locais (nome) values ('direto'); raise exception 'A inseriu local direto na tabela';
  exception when insufficient_privilege then null; end;

  -- as funções que mexem na chave são só do dono do banco
  begin perform public.fn_cripto_chave(); raise exception 'A chamou fn_cripto_chave';
  exception when insufficient_privilege then null; end;
  begin perform public.fn_decifrar('\x00'::bytea); raise exception 'A chamou fn_decifrar';
  exception when insufficient_privilege then null; end;
  begin perform public.fn_cifrar('{"a":1}'::jsonb); raise exception 'A chamou fn_cifrar';
  exception when insufficient_privilege then null; end;
  begin perform public.fn_hash_documento('123'); raise exception 'A chamou fn_hash_documento';
  exception when insufficient_privilege then null; end;

  -- regras de dado
  begin perform public.fn_cliente_salvar(null, '{"nome":"Dup","tipo_pessoa":"juridica","documento":"12345678000199"}'::jsonb); raise exception 'CNPJ duplicado passou';
  exception when unique_violation then null; end;
  begin perform public.fn_cliente_salvar(null, '{"nome":"PF","tipo_pessoa":"fisica","documento":"12345678000199"}'::jsonb); raise exception 'CNPJ em pessoa física passou';
  exception when check_violation then null; end;
  begin perform public.fn_cliente_salvar(null, '{"tipo_pessoa":"juridica"}'::jsonb); raise exception 'cliente sem nome passou';
  exception when check_violation then null; end;
  begin perform public.fn_cliente_salvar(null, '{"nome":"X"}'::jsonb, '[{"nome":"M","cpf":"123"}]'::jsonb); raise exception 'CPF curto do motorista passou';
  exception when check_violation then null; end;
  begin perform public.fn_local_salvar(null, '{"nome":"cts a"}'::jsonb); raise exception 'local duplicado (caixa diferente) passou';
  exception when unique_violation then null; end;
  -- trocar os motoristas substitui a lista (não acumula)
  perform public.fn_cliente_salvar(ca, '{"nome":"Empresa A","tipo_pessoa":"juridica","documento":"12345678000199"}'::jsonb, '[{"nome":"Só um"}]'::jsonb);
  select count(*) into n from public.fn_cliente_motoristas(ca); if n <> 1 then raise exception 'lista de motoristas devia ter 1, tem %', n; end if;
  -- editar sem mandar e-mail apaga o e-mail (o app reenvia tudo)
  if public.fn_cliente_sensiveis(ca) ? 'email' then raise exception 'e-mail devia ter sido removido'; end if;

  -- sem login (anon)
  reset role;
  set local role anon;
  begin perform 1 from public.clientes; raise exception 'anon conseguiu LER clientes';
  exception when insufficient_privilege then null; end;
  begin perform public.fn_cliente_sensiveis(ca); raise exception 'anon chamou fn_cliente_sensiveis';
  exception when insufficient_privilege then null; end;
  begin perform public.fn_cliente_salvar(null, '{"nome":"x"}'::jsonb); raise exception 'anon chamou fn_cliente_salvar';
  exception when insufficient_privilege then null; end;
  reset role;

  -- como DONO do banco: o que está gravado NÃO é texto aberto
  select encode(sensiveis, 'escape') into bruto from public.clientes where id = ca;
  if bruto like '%12345678000199%' or bruto like '%@empresa.com%' then raise exception 'sensiveis do cliente contém texto aberto'; end if;
  select string_agg(encode(sensiveis, 'escape'), '') into bruto from public.locais where id = la;
  if bruto like '%90000-0001%' or bruto like '%chico@%' then raise exception 'sensiveis do local contém texto aberto'; end if;
  select documento_hash into t from public.clientes where id = ca;
  if t is null or t like '%12345678000199%' or length(t) <> 64 then raise exception 'índice do documento inválido: %', t; end if;

  raise exception 'TESTE_OK: dados confidenciais cifrados em repouso, só membro do espaço lê, app não toca na coluna cifrada nem na chave, duplicados e formatos barrados, anon bloqueado.';
end $$;
