-- manifest: o transporte guarda a rota (origem e destino puxados do evento) e o pagamento (status, valor real, data) NELE MESMO.
-- A tabela "pagamentos" deixa de ser usada pelo app (fica no banco, sem apagar nada); os dados dela são copiados para os transportes ligados.
-- Status do pagamento depende da modalidade: PTA = solicitado/aprovado/pago; TSO = orcamento_recebido/aprovar_nf/aprovado; retirada = sem pagamento. Idempotente.

alter table public.transportes add column if not exists origem text check (origem is null or length(btrim(origem)) between 1 and 300);
alter table public.transportes add column if not exists destino text check (destino is null or length(btrim(destino)) between 1 and 300);
alter table public.transportes add column if not exists status_pagamento text;
alter table public.transportes add column if not exists valor_real numeric(12, 2) check (valor_real is null or valor_real >= 0);
alter table public.transportes add column if not exists data_pagamento date;
alter table public.transportes add column if not exists departamento text check (departamento is null or length(btrim(departamento)) between 1 and 80);

-- Copia o que existia nos pagamentos para os transportes ligados a eles (só onde ainda está vazio).
update public.transportes t
   set status_pagamento = coalesce(t.status_pagamento, p.status),
       valor_real = coalesce(t.valor_real, p.valor_real),
       data_pagamento = coalesce(t.data_pagamento, p.data_pagamento),
       departamento = coalesce(t.departamento, p.departamento)
  from public.pagamentos p
 where t.pagamento_id = p.id and t.workspace_id = p.workspace_id;

create or replace function public.fn_transporte_pagamento()
returns trigger language plpgsql set search_path = public as $$
declare validos text[]; inicial text;
begin
  if new.modalidade = 'pta' then validos := array['solicitado', 'aprovado', 'pago']; inicial := 'solicitado';
  elsif new.modalidade = 'tso' then validos := array['orcamento_recebido', 'aprovar_nf', 'aprovado']; inicial := 'orcamento_recebido';
  else validos := array[]::text[]; inicial := null; end if;
  -- retirada não tem pagamento; trocar a modalidade que deixa o status sem sentido volta ao primeiro
  if inicial is null then
    new.status_pagamento := null; new.valor_real := null; new.data_pagamento := null;
  else
    if new.status_pagamento is null then new.status_pagamento := inicial;
    elsif not (new.status_pagamento = any(validos)) then
      if tg_op = 'UPDATE' and new.modalidade is distinct from old.modalidade then new.status_pagamento := inicial;
      else raise exception 'status_pagamento_invalido: esse status não existe para essa modalidade' using errcode = '23514'; end if;
    end if;
    if new.status_pagamento = 'pago' and new.data_pagamento is null then new.data_pagamento := (now() at time zone 'America/Sao_Paulo')::date; end if;
  end if;
  return new;
end $$;
drop trigger if exists transportes_pagamento on public.transportes;
create trigger transportes_pagamento before insert or update on public.transportes for each row execute function public.fn_transporte_pagamento();
revoke execute on function public.fn_transporte_pagamento() from public, anon, authenticated;

-- Quem já existia ganha o status inicial (o gatilho preenche ao tocar na linha).
update public.transportes set modalidade = modalidade where status_pagamento is null and modalidade <> 'retirada';
