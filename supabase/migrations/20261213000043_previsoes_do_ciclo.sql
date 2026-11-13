-- manifest: Previsões do ciclo de vida do veículo: datas que ainda vão acontecer (previsão de liberação, de faturamento e de emplacamento). São campos SEPARADOS das datas reais: o ciclo de vida NÃO avança com a previsão (só quando a data real é preenchida, como hoje). O carro em Pedido recebido / Liberado / Em transporte 0km continua Indisponível, mas o app deixa reservá-lo para eventos a partir da previsão (só avisa se o evento começa antes). Idempotente. NÃO aplicar sem o aval do Arthur.
alter table public.veiculos add column if not exists data_liberacao_prevista date;
alter table public.veiculos add column if not exists data_faturamento_prevista date;
alter table public.veiculos add column if not exists data_emplacamento_prevista date;
