-- manifest: excluir um evento apaga TUDO que é dele: reservas (com checklists), transportes, locais, pedidos de modelo e agora também os contratos (e aditivos).
-- Antes o contrato travava a exclusão (RESTRICT). Idempotente.
alter table public.contratos_comodato drop constraint if exists contratos_comodato_evento_id_workspace_id_fkey;
alter table public.contratos_comodato add constraint contratos_comodato_evento_id_workspace_id_fkey
  foreign key (evento_id, workspace_id) references public.eventos (id, workspace_id) on delete cascade;
