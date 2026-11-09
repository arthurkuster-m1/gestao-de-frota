import { useMemo } from "react";
import { ChecklistEmMassaSheet } from "./ChecklistEmMassaSheet";
import type { useDadosDeEventos } from "../eventos/useDadosDeEventos";
import { reservasSemChecklist } from "../../lib/checklists/regras";

/**
 * Colocou o evento em uso à mão? Os carros só entram em uso com o checklist de envio, então o app pergunta: "estes carros não têm
 * checklist — fazer o de todos agora?" (com a data do envio, que dá para trocar).
 */
export function AvisoDeChecklistEmMassa({ d }: { d: ReturnType<typeof useDadosDeEventos> }) {
  const eventoId = d.pendenciaDeChecklist;
  const evento = d.eventos?.find((e) => e.id === eventoId) ?? null;
  const carros = useMemo(() => {
    if (!eventoId) return [];
    const doEvento = [...d.reservas, ...d.reservasSemData].filter((r) => r.evento_id === eventoId);
    const ids = new Set(reservasSemChecklist(doEvento, d.ck.checklists, "saida"));
    return doEvento.filter((r) => ids.has(r.id)).map((r) => { const v = d.veiculos.find((x) => x.id === r.veiculo_id); return { reservaId: r.id, codigo: v ? (v.codigo ?? v.modelo.toUpperCase()) : "?" }; });
  }, [eventoId, d.reservas, d.reservasSemData, d.ck.checklists, d.veiculos]);
  return <ChecklistEmMassaSheet aberto={!!eventoId && carros.length > 0} onFechar={d.fecharPendenciaDeChecklist} momento="saida" titulo={evento ? `${evento.nome} em uso: checklist de envio` : "Checklist de envio"} carros={carros} onConfirmar={(ids, dados) => d.ck.salvarEmMassa(ids, "saida", dados)} />;
}
