-- manifest: cada carro do evento pode ter um ENDEREÇO DE RETORNO próprio (às vezes volta para a origem, às vezes vai para outro lugar).
-- Vazio = volta para a origem do carro (ou do evento). Idempotente.
alter table public.evento_veiculos add column if not exists endereco_retorno text check (endereco_retorno is null or length(btrim(endereco_retorno)) between 1 and 300);
