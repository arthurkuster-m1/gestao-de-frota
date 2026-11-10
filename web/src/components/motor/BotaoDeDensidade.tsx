import { Rows } from "@phosphor-icons/react";
import { useDensidade } from "../../lib/densidade";

/** Alterna a densidade das tabelas (compacta ⇄ confortável) direto da barra de ferramentas. */
export function BotaoDeDensidade() {
  const { densidade, alternar } = useDensidade();
  const compacta = densidade === "compacta";
  return (
    <button type="button" className={compacta ? "mt-btn mt-btn--icone is-on" : "mt-btn mt-btn--icone"} aria-label={`Densidade das tabelas: ${compacta ? "compacta" : "confortável"}. Clique para mudar.`} aria-pressed={compacta}
      title={compacta ? "Densidade compacta (clique para confortável)" : "Densidade confortável (clique para compacta)"} onClick={alternar} data-testid="densidade-tabelas"><Rows size={18} /></button>
  );
}
