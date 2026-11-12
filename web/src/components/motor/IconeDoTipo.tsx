import { CalendarBlank, Car, CaretCircleDown, CheckSquare, Hash, ListBullets, TextAa, User } from "@phosphor-icons/react";
import type { TipoDeCampo } from "../../lib/motor/consulta";

/** O ícone pequeno do tipo de cada coluna (texto, opção/status, data, número, caixa…), no cabeçalho da tabela. */
export function IconeDoTipo({ tipo, icone }: { tipo: TipoDeCampo; icone?: "carro" }) {
  const p = { size: 14, "aria-hidden": true, className: "mt-th__icone" } as const;
  if (icone === "carro") return <Car {...p} />;
  switch (tipo) {
    case "opcao": return <CaretCircleDown {...p} />;
    case "data": return <CalendarBlank {...p} />;
    case "numero": return <Hash {...p} />;
    case "caixa": return <CheckSquare {...p} />;
    case "multi": return <ListBullets {...p} />;
    case "pessoa": return <User {...p} />;
    default: return <TextAa {...p} />;
  }
}
