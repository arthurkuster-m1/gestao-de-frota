import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { useToast } from "../../ds";

/** Botãozinho que copia um texto (ex.: o endereço completo) para a área de transferência. Some quando não há texto. */
export function BotaoCopiar({ texto, rotulo = "Copiar endereço", aviso = "Endereço copiado" }: { texto: string | null | undefined; rotulo?: string; aviso?: string }) {
  const toast = useToast();
  const [copiado, setCopiado] = useState(false);
  const t = (texto ?? "").trim();
  if (!t) return null;
  async function copiar(e: React.MouseEvent) {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(t); setCopiado(true); window.setTimeout(() => setCopiado(false), 1500); toast(aviso); }
    catch { toast("Não consegui copiar. Libere a área de transferência no navegador."); }
  }
  return <button type="button" className="mt-btn mt-btn--icone mt-copiar" aria-label={rotulo} title={rotulo} onClick={(e) => void copiar(e)} data-testid="copiar-endereco">{copiado ? <Check size={16} weight="bold" /> : <Copy size={16} />}</button>;
}
