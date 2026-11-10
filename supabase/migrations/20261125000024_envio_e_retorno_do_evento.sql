-- manifest: datas de ENVIO (quando o carro sai para chegar a tempo) e de RETORNO (quando chega ao endereço de retorno) no evento e em cada carro,
-- mais os km aproximados da ida e da volta calculados pelas rotas. Ordem das datas: Envio, Chegada, Retirada, Retorno. Idempotente.
alter table public.eventos add column if not exists envio_previsto date;
alter table public.eventos add column if not exists retorno_previsto date;
alter table public.eventos add column if not exists distancia_ida_km integer check (distancia_ida_km is null or distancia_ida_km between 0 and 20000);
alter table public.eventos add column if not exists distancia_volta_km integer check (distancia_volta_km is null or distancia_volta_km between 0 and 20000);
alter table public.evento_veiculos add column if not exists envio date;
alter table public.evento_veiculos add column if not exists retorno date;
