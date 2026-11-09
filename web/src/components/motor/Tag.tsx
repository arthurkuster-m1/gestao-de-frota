import { Check } from "@phosphor-icons/react";
import { cx } from "../../ds";
import { corDaOpcao, useCores } from "../../lib/motor/cores";
import type { OpcaoDoCampo } from "./tipos";

/** Uma opção como TAG colorida, viva, com bolinha (como no Notion). A cor é a que a pessoa escolheu para a opção, ou a de fábrica. Serve de botão alternável (filtros) ou de linha de lista. */
export function Tag({ opcao, campoId, selecionada, onClick, comCheck, comoOpcao }: { opcao: OpcaoDoCampo; campoId?: string; selecionada?: boolean; onClick?: () => void; comCheck?: boolean; /** dentro de uma lista de escolha única (listbox); senão é um botão alternável (filtros) */ comoOpcao?: boolean }) {
  const cor = corDaOpcao(useCores(), campoId, opcao.value, opcao.tom);
  const classe = cx("ds-badge", `ds-badge--cor-${cor}`, "mt-tag", selecionada && "is-sel");
  if (!onClick) return <span className={classe}>{opcao.label}</span>;
  return <button type="button" {...(comoOpcao ? { role: "option", "aria-selected": !!selecionada } : { "aria-pressed": !!selecionada })} className={classe} onClick={onClick}>{opcao.label}{comCheck && selecionada && <Check size={12} weight="bold" />}</button>;
}
