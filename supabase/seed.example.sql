-- Vincula o seu login ao espaço de trabalho da Frota. Pode rodar de novo sem duplicar.
-- 1) Authentication > Users > Add user (marque "Auto Confirm User").  2) Troque o e-mail e o nome abaixo.  3) Rode no SQL Editor.
do $$
declare
  v_email text := 'SEU-EMAIL@exemplo.com';
  v_nome  text := 'Arthur';
  v_user  uuid;
  v_ws    uuid;
begin
  select id into v_user from auth.users where email = v_email;
  if v_user is null then
    raise exception 'Usuário % não encontrado: crie em Authentication > Users antes.', v_email;
  end if;
  select workspace_id into v_ws from public.workspace_members where user_id = v_user;
  if v_ws is null then
    insert into public.workspaces (name) values ('Frota') returning id into v_ws;
    insert into public.workspace_members (workspace_id, user_id, display_name, role) values (v_ws, v_user, v_nome, 'owner');
  end if;
end $$;
