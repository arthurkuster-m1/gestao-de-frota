-- manifest: departamento do veículo (todos são do Marketing; os emprestados de outros departamentos — RP, UC, Acessórios… — ficam identificados). Idempotente.
alter table public.veiculos add column if not exists departamento text not null default 'Marketing' check (length(btrim(departamento)) between 1 and 60);
create index if not exists veiculos_departamento_idx on public.veiculos (workspace_id, departamento);
