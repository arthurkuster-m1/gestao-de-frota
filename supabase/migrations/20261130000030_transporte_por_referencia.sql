-- manifest: o transporte passa a ser identificado pelo código (campo "Transporte" do carro no evento) e pode existir antes do código/da modalidade:
-- a modalidade deixa de ser obrigatória (rascunho de transporte = carro com km, valor etc. e ainda sem código). Idempotente.
alter table public.transportes alter column modalidade drop not null;
