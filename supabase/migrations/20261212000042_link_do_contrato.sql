-- manifest: Link do contrato (a página do documento na plataforma de assinatura, ex.: D4Sign): coluna `link` em contratos_comodato, editável a qualquer momento. Idempotente. NÃO aplicar sem o aval do Arthur.
alter table public.contratos_comodato add column if not exists link text;
alter table public.contratos_comodato drop constraint if exists contratos_link_check;
alter table public.contratos_comodato add constraint contratos_link_check check (link is null or (length(link) <= 2000 and link ~* '^https?://'));
