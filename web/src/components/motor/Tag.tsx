import { Check } from "@phosphor-icons/react";
import { cx } from "../../ds";
import type { OpcaoDoCampo } from "./tipos";

/** Uma opção como TAG colorida (a cor vem do status), como no Notion. Serve de botão alternável (filtros) ou de linha de lista. */
export function Tag({ opcao, selecionada, onClick, comCheck, comoOpcao }: { opcao: OpcaoDoCampo; selecionada?: boolean; onClick?: () => void; comCheck?: boolean; /** dentro de uma lista de escolha única (listbox); senão é um botão alternável (filtros) */ comoOpcao?: boolean }) {
  const classe = cx("ds-badge", `ds-badge--${opcao.tom ?? "neutral"}`, "mt-tag", selecionada && "is-sel");
  if (!onClick) return <span className={classe}>{opcao.label}</span>;
  return <button type="button" {...(comoOpcao ? { role: "option", "aria-selected": !!selecionada } : { "aria-pressed": !!selecionada })} className={classe} onClick={onClick}>{opcao.label}{comCheck && selecionada && <Check size={12} weight="bold" />}</button>;
}
