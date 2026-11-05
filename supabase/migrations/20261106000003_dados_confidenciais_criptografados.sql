-- Dados confidenciais criptografados (CPF, CNPJ, CNH, e-mails e telefones de contato).
-- Regras:
--  * A chave nasce no Vault do Supabase (nome 'frota_chave_dados') e NUNCA sai do banco: só funções do dono a leem.
--  * Os dados confidenciais ficam num blob criptografado (coluna `sensiveis`, AES-256). Nada em texto aberto.
--  * O app não lê nem grava `sensiveis` direto: só pelas funções abaixo, que conferem se você é membro do espaço.
--  * CPF/CNPJ de cliente tem um "índice cego" (HMAC) só para impedir duplicado, sem revelar o número.
--  * Placa e VIN NÃO são criptografados (busca e código do carro dependem deles).
-- Aplique depois da 0002, uma vez. Esta migration pode ser reaplicada.

-- ───────────────────────── chave no Vault ─────────────────────────
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'frota_chave_dados') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'frota_chave_dados',
                                'Chave dos dados confidenciais da Frota (CPF, CNPJ, CNH, e-mails e telefones). GUARDE UMA CÓPIA no gerenciador de senhas.');
  end if;
end $$;

-- ───────────────────────── ajudantes (só o dono do banco executa) ─────────────────────────
create or replace function public.fn_cripto_chave() returns text
language plpgsql stable security definer set search_path = public, extensions, vault as $$
declare k text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'frota_chave_dados';
  if k is null or k = '' then raise exception 'Chave de criptografia ausente no Vault' using errcode = 'XX000'; end if;
  return k;
end $$;

create or replace function public.fn_cifrar(p jsonb) returns bytea
language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if p is null or p = '{}'::jsonb then return null; end if;
  return extensions.pgp_sym_encrypt(p::text, public.fn_cripto_chave(), 'cipher-algo=aes256');
end $$;

create or replace function public.fn_decifrar(p bytea) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p is null then return '{}'::jsonb; end if;
  return extensions.pgp_sym_decrypt(p, public.fn_cripto_chave())::jsonb;
end $$;

create or replace function public.fn_hash_documento(p text) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  return encode(extensions.hmac(p, public.fn_cripto_chave(), 'sha256'), 'hex');
end $$;

revoke execute on function public.fn_cripto_chave(), public.fn_cifrar(jsonb), public.fn_decifrar(bytea), public.fn_hash_documento(text) from public, anon, authenticated;

-- ───────────────────────── tabelas: tira o texto aberto, põe o blob ─────────────────────────
do $$
declare tem boolean;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clientes' and column_name = 'documento')
     and exists (select 1 from public.clientes) then
    raise exception 'clientes já tem linhas com CPF/CNPJ em texto aberto: migre os dados antes de apagar as colunas';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cliente_motoristas' and column_name = 'cpf')
     and exists (select 1 from public.cliente_motoristas) then
    raise exception 'cliente_motoristas já tem linhas em texto aberto: migre os dados antes de apagar as colunas';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locais' and column_name = 'contato_telefone') then
    execute 'select exists (select 1 from public.locais where contato_telefone is not null)' into tem;  -- dinâmico: a coluna some depois da 1ª aplicação
    if tem then raise exception 'locais já tem telefones em texto aberto: migre os dados antes de apagar a coluna'; end if;
  end if;
end $$;

alter table public.clientes drop column if exists documento, drop column if exists email, drop column if exists testemunha_email;
alter table public.clientes add column if not exists documento_hash text, add column if not exists sensiveis bytea;
create unique index if not exists clientes_documento_hash_uidx on public.clientes (workspace_id, documento_hash) where documento_hash is not null;

alter table public.cliente_motoristas drop column if exists cpf, drop column if exists cnh_registro, drop column if exists cnh_validade;
alter table public.cliente_motoristas add column if not exists sensiveis bytea;

alter table public.locais drop column if exists contato_telefone;
alter table public.locais add column if not exists sensiveis bytea;

-- ───────────────────────── permissões: o app não toca em `sensiveis` ─────────────────────────
revoke all on public.clientes, public.cliente_motoristas, public.locais from authenticated;
grant select (id, workspace_id, tipo_pessoa, nome, cep, endereco, numero, complemento, cidade, estado, testemunha_nome, comentarios, created_at, updated_at) on public.clientes to authenticated;
grant select (id, workspace_id, cliente_id, nome, created_at) on public.cliente_motoristas to authenticated;
grant select (id, workspace_id, nome, cep, endereco, numero, complemento, cidade, estado, contato_nome, created_at, updated_at) on public.locais to authenticated;
grant delete on public.clientes, public.cliente_motoristas, public.locais to authenticated;

-- ───────────────────────── funções de gravar e ler (conferem o espaço de trabalho) ─────────────────────────
create or replace function public.fn_texto(p jsonb, k text) returns text language sql immutable as $$ select nullif(btrim(p ->> k), '') $$;
revoke execute on function public.fn_texto(jsonb, text) from public, anon;

create or replace function public.fn_cliente_salvar(p_id uuid, p_cliente jsonb, p_motoristas jsonb default null) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  ws uuid := public.fn_default_workspace();
  v_tipo text; v_nome text; v_doc text; v_id uuid; m jsonb; v_cpf text; v_sens jsonb;
begin
  if ws is null then raise exception 'Sem espaço de trabalho' using errcode = '42501'; end if;
  v_tipo := coalesce(public.fn_texto(p_cliente, 'tipo_pessoa'), 'juridica');
  if v_tipo not in ('fisica', 'juridica') then raise exception 'Tipo de pessoa inválido' using errcode = '23514'; end if;
  v_nome := public.fn_texto(p_cliente, 'nome');
  if v_nome is null then raise exception 'Informe o nome ou a razão social' using errcode = '23514'; end if;
  v_doc := nullif(regexp_replace(coalesce(p_cliente ->> 'documento', ''), '\D', '', 'g'), '');
  if v_doc is not null and not ((v_tipo = 'fisica' and length(v_doc) = 11) or (v_tipo = 'juridica' and length(v_doc) = 14)) then
    raise exception 'CPF deve ter 11 dígitos e CNPJ 14' using errcode = '23514';
  end if;
  v_sens := jsonb_strip_nulls(jsonb_build_object('documento', v_doc, 'email', public.fn_texto(p_cliente, 'email'), 'testemunha_email', public.fn_texto(p_cliente, 'testemunha_email')));

  if p_id is null then
    insert into public.clientes (workspace_id, tipo_pessoa, nome, cep, endereco, numero, complemento, cidade, estado, testemunha_nome, comentarios, documento_hash, sensiveis)
    values (ws, v_tipo, v_nome, public.fn_texto(p_cliente, 'cep'), public.fn_texto(p_cliente, 'endereco'), public.fn_texto(p_cliente, 'numero'), public.fn_texto(p_cliente, 'complemento'),
            public.fn_texto(p_cliente, 'cidade'), upper(public.fn_texto(p_cliente, 'estado')), public.fn_texto(p_cliente, 'testemunha_nome'), public.fn_texto(p_cliente, 'comentarios'),
            case when v_doc is null then null else public.fn_hash_documento(v_doc) end, public.fn_cifrar(v_sens))
    returning id into v_id;
  else
    update public.clientes set tipo_pessoa = v_tipo, nome = v_nome, cep = public.fn_texto(p_cliente, 'cep'), endereco = public.fn_texto(p_cliente, 'endereco'), numero = public.fn_texto(p_cliente, 'numero'),
           complemento = public.fn_texto(p_cliente, 'complemento'), cidade = public.fn_texto(p_cliente, 'cidade'), estado = upper(public.fn_texto(p_cliente, 'estado')),
           testemunha_nome = public.fn_texto(p_cliente, 'testemunha_nome'), comentarios = public.fn_texto(p_cliente, 'comentarios'),
           documento_hash = case when v_doc is null then null else public.fn_hash_documento(v_doc) end, sensiveis = public.fn_cifrar(v_sens)
     where id = p_id and workspace_id = ws returning id into v_id;
    if v_id is null then raise exception 'Cliente não encontrado' using errcode = '42501'; end if;
  end if;

  if p_motoristas is not null then
    delete from public.cliente_motoristas where cliente_id = v_id and workspace_id = ws;
    for m in select * from jsonb_array_elements(p_motoristas) loop
      if public.fn_texto(m, 'nome') is null then raise exception 'Todo motorista precisa de nome' using errcode = '23514'; end if;
      v_cpf := nullif(regexp_replace(coalesce(m ->> 'cpf', ''), '\D', '', 'g'), '');
      if v_cpf is not null and length(v_cpf) <> 11 then raise exception 'CPF do motorista deve ter 11 dígitos' using errcode = '23514'; end if;
      insert into public.cliente_motoristas (workspace_id, cliente_id, nome, sensiveis)
      values (ws, v_id, public.fn_texto(m, 'nome'), public.fn_cifrar(jsonb_strip_nulls(jsonb_build_object('cpf', v_cpf, 'cnh_registro', public.fn_texto(m, 'cnh_registro'), 'cnh_validade', public.fn_texto(m, 'cnh_validade')))));
    end loop;
  end if;
  return v_id;
end $$;

create or replace function public.fn_cliente_sensiveis(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r bytea; achou boolean;
begin
  select sensiveis, true into r, achou from public.clientes where id = p_id and workspace_id in (select public.fn_my_workspaces());
  if achou is not true then raise exception 'Cliente não encontrado' using errcode = '42501'; end if;
  return public.fn_decifrar(r);
end $$;

create or replace function public.fn_cliente_motoristas(p_cliente uuid) returns table (id uuid, nome text, cpf text, cnh_registro text, cnh_validade text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    select m.id, m.nome, d ->> 'cpf', d ->> 'cnh_registro', d ->> 'cnh_validade'
      from public.cliente_motoristas m, lateral (select public.fn_decifrar(m.sensiveis) as d) x
     where m.cliente_id = p_cliente and m.workspace_id in (select public.fn_my_workspaces()) order by m.created_at, m.id;
end $$;

create or replace function public.fn_local_salvar(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare ws uuid := public.fn_default_workspace(); v_id uuid; v_sens jsonb;
begin
  if ws is null then raise exception 'Sem espaço de trabalho' using errcode = '42501'; end if;
  if public.fn_texto(p, 'nome') is null then raise exception 'Informe o nome do local' using errcode = '23514'; end if;
  v_sens := jsonb_strip_nulls(jsonb_build_object('contato_telefone', public.fn_texto(p, 'contato_telefone'), 'contato_email', public.fn_texto(p, 'contato_email')));
  if p_id is null then
    insert into public.locais (workspace_id, nome, cep, endereco, numero, complemento, cidade, estado, contato_nome, sensiveis)
    values (ws, public.fn_texto(p, 'nome'), public.fn_texto(p, 'cep'), public.fn_texto(p, 'endereco'), public.fn_texto(p, 'numero'), public.fn_texto(p, 'complemento'),
            public.fn_texto(p, 'cidade'), upper(public.fn_texto(p, 'estado')), public.fn_texto(p, 'contato_nome'), public.fn_cifrar(v_sens)) returning id into v_id;
  else
    update public.locais set nome = public.fn_texto(p, 'nome'), cep = public.fn_texto(p, 'cep'), endereco = public.fn_texto(p, 'endereco'), numero = public.fn_texto(p, 'numero'),
           complemento = public.fn_texto(p, 'complemento'), cidade = public.fn_texto(p, 'cidade'), estado = upper(public.fn_texto(p, 'estado')),
           contato_nome = public.fn_texto(p, 'contato_nome'), sensiveis = public.fn_cifrar(v_sens)
     where id = p_id and workspace_id = ws returning id into v_id;
    if v_id is null then raise exception 'Local não encontrado' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.fn_local_contato(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r bytea; achou boolean;
begin
  select sensiveis, true into r, achou from public.locais where id = p_id and workspace_id in (select public.fn_my_workspaces());
  if achou is not true then raise exception 'Local não encontrado' using errcode = '42501'; end if;
  return public.fn_decifrar(r);
end $$;

-- Função nova em public nasce exposta: revoga as DUAS origens e libera só quem está logado.
revoke execute on function public.fn_cliente_salvar(uuid, jsonb, jsonb), public.fn_cliente_sensiveis(uuid), public.fn_cliente_motoristas(uuid), public.fn_local_salvar(uuid, jsonb), public.fn_local_contato(uuid) from public, anon;
grant execute on function public.fn_cliente_salvar(uuid, jsonb, jsonb), public.fn_cliente_sensiveis(uuid), public.fn_cliente_motoristas(uuid), public.fn_local_salvar(uuid, jsonb), public.fn_local_contato(uuid) to authenticated;
