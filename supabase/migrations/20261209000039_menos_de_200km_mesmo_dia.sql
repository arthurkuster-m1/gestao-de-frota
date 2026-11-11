-- manifest: distância de menos de 200 km não tem dia de viagem (o carro sai e chega no mesmo dia); acima disso, km ÷ 500 para cima. Idempotente.
create or replace function public.fn_transporte_regras()
returns trigger language plpgsql set search_path = public as $$
declare calc integer; tipo_pag text;
begin
  calc := case when new.modalidade = 'retirada' or coalesce(new.distancia_km, 0) < 200 then 0 else ceil(new.distancia_km / 500.0)::integer end;
  if tg_op = 'INSERT' then
    if new.dias_viagem is null then new.dias_viagem := calc; end if;
  elsif (new.distancia_km is distinct from old.distancia_km or new.modalidade is distinct from old.modalidade)
        and new.dias_viagem is not distinct from old.dias_viagem then
    new.dias_viagem := calc;
  end if;
  if new.pagamento_id is not null then
    select tipo into tipo_pag from public.pagamentos where id = new.pagamento_id and workspace_id = new.workspace_id;
    if not ((new.modalidade = 'pta' and tipo_pag = 'pta') or (new.modalidade = 'tso' and tipo_pag = 'nf_tso')) then
      raise exception 'transporte_pagamento_incompativel: PTA liga com pagamento de PTA e TSO com NF da TSO' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.fn_transporte_regras() from public, anon, authenticated;
