import type { ReactNode } from "react";
import { Badge } from "../../ds";
import type { ValorDoCampo } from "../../lib/motor/consulta";
import { formatarDiaBr } from "../../lib/motor/datas";
import type { CampoDaTela } from "./tipos";

/** O valor de um campo como se lê na tela (tabela, card, janela): badge, data em dd/mm/aaaa, "—" quando vazio. */
export function formatar<T>(c: CampoDaTela<T>, l: T): ReactNode {
  if (c.celula) return c.celula(l);
  const v: ValorDoCampo = c.valorDe(l);
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return <span className="mt-vazio">—</span>;
  if (c.tipo === "caixa") return v === true ? <Badge tone="info">Sim</Badge> : <span className="mt-vazio">Não</span>;
  if (c.tipo === "data") return formatarDiaBr(String(v));
  if (c.tipo === "opcao") {
    const o = c.opcoes?.find((x) => x.value === v);
    return o?.tom ? <Badge tone={o.tom}>{o.label}</Badge> : (o?.label ?? String(v));
  }
  if (Array.isArray(v)) return v.map((x) => c.rotuloDoValor?.(x) ?? x).join(", ");
  return String(v);
}
