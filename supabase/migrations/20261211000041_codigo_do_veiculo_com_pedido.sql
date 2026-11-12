-- manifest: Código do veículo sem VIN passa a usar o número do Pedido: MODELO [VERSÃO] + 4 últimos do VIN; sem VIN, MODELO [VERSÃO] + Pedido inteiro ("MONTANA RS VO01V71"); sem VIN e sem pedido, vazio. Recria a coluna calculada `codigo`. Idempotente. NÃO aplicar sem o aval do Arthur.
do $$
declare expr text;
begin
  select pg_get_expr(d.adbin, d.adrelid) into expr
    from pg_attrdef d join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
   where d.adrelid = 'public.veiculos'::regclass and a.attname = 'codigo';
  if expr is not null and expr ilike '%pedido%' then return; end if;   -- já está na regra nova
  alter table public.veiculos drop column if exists codigo;
  alter table public.veiculos add column codigo text generated always as (
    case when vin is null and nullif(trim(pedido), '') is null then null
         else upper(trim(modelo)) || coalesce(' ' || upper(nullif(trim(versao), '')), '')
              || ' ' || case when vin is not null then right(vin, 4) else upper(trim(pedido)) end end
  ) stored;
end $$;
