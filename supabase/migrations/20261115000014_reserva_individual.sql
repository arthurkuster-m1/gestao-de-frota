-- Planejamento individual por carro dentro do evento: origem, endereço de chegada e status próprios da reserva.
-- Vazio = herda do evento (chegada/retirada previstas, primeiro local, status do evento). Idempotente.
alter table public.evento_veiculos add column if not exists origem text check (origem is null or length(btrim(origem)) between 1 and 300);
alter table public.evento_veiculos add column if not exists endereco_chegada text check (endereco_chegada is null or length(btrim(endereco_chegada)) between 1 and 300);
alter table public.evento_veiculos add column if not exists status_individual text
  check (status_individual is null or status_individual in ('planejado', 'solicitar_transporte', 'envio_solicitado', 'em_uso', 'solicitar_retorno', 'retorno_solicitado', 'concluido'));
