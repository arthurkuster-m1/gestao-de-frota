# Supabase da Frota

Projeto **`frota`** (São Paulo): ref `hqivwljmjnagjuxzdanj`, URL `https://hqivwljmjnagjuxzdanj.supabase.co`.
Criado em 05/11/2026, ainda **vazio**: falta aplicar o núcleo (passos abaixo, uns 10 minutos).

## Passo a passo (nesta ordem)

1. **Aplicar o núcleo.** Supabase › *SQL Editor* › *New query* › cole `migrations/20261105000001_core_workspaces.sql` › *Run*.
   (O assistente também consegue aplicar, mas o Supabase pede a sua aprovação na tela e o pedido expira em 60 segundos.)
2. **Trancar o cadastro.** *Authentication › Sign In / Providers › Email*: desligue **Allow new users to sign up**.
   (Mesmo aberto, quem se cadastrar não vê nada, porque a RLS exige ser membro de um espaço. Fechar é só higiene.)
3. **Criar o seu usuário.** *Authentication › Users › Add user › Create new user*, e-mail e senha, marcando **Auto Confirm User**.
4. **Vincular você ao espaço.** Abra `seed.example.sql`, troque o e-mail e o nome, cole no *SQL Editor* e rode. Pode rodar de novo sem duplicar.
5. **Provar o isolamento.** Cole e rode `tests/rls-core.sql`. O resultado esperado é um **erro** que começa com `TESTE_OK` (é de propósito: assim o teste desfaz tudo o que fez). Qualquer outra mensagem é falha.
6. **Trocar a senha do banco.** *Project Settings › Database › Reset database password*. A senha atual foi gerada pelo Supabase e ninguém a conhece. Guarde a nova no gerenciador de senhas (ela será usada pelo backup automático).
7. Conferir *Advisors › Security*: não deve haver alerta de tabela sem RLS.

## Regras (as mesmas do `familia-kuster`)
- **RLS em toda tabela.** Cada tabela de módulo carrega `workspace_id uuid not null references workspaces(id)` e a política é "sou membro deste espaço" (`workspace_id in (select fn_my_workspaces())`).
- A chave **anon/publishable** é pública por desenho (vai para o navegador). A chave **`service_role` nunca** entra no navegador nem no repositório.
- **Função nova em `public` nasce exposta**: termine toda `create function` com `revoke execute ... from public, anon`.
- **Migrations idempotentes**, versionadas aqui; nenhum `ALTER` solto no painel.
- Dinheiro em centavos (`bigint`); datas em `date`/`timestamptz`.
- Cada migration nova ganha um teste de isolamento ao lado (ver `tests/`), e o teste é sabotado uma vez para provar que ele vigia.
