import { useVersaoDosDados } from "../../lib/sincronia";
import { useEffect, useState } from "react";
import { useToast } from "../../ds";
import { atualizarChecklist, criarChecklist, criarChecklistsEmMassa, listarChecklists } from "../../lib/checklists/dados";
import { estadoAposChecklist } from "../../lib/checklists/regras";
import type { Checklist, ChecklistNovo, Momento } from "../../lib/checklists/tipos";
import type { Reserva } from "../../lib/eventos/tipos";

/** Os checklists. Sem a migration 0010 a lista fica vazia (e o botão avisa o que falta ao tentar salvar). `aoMudarReserva` reflete na tela o estado que o banco muda sozinho. */
export function useChecklists(aoMudarReserva: (reservaId: string, estado: Reserva["estado"]) => void, estadoDe: (reservaId: string) => Reserva["estado"] | undefined) {
  const toast = useToast();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const versao = useVersaoDosDados();
  useEffect(() => { listarChecklists().then(setChecklists, () => setChecklists([])); }, [versao]);

  const salvar = async (reservaId: string, momento: Momento, existente: Checklist | null, dados: Omit<ChecklistNovo, "reserva_id" | "momento">) => {
    if (existente) {
      const c = await atualizarChecklist(existente.id, dados);
      setChecklists((l) => l.map((x) => (x.id === c.id ? c : x))); toast("Checklist atualizado");
      return;
    }
    const c = await criarChecklist({ ...dados, reserva_id: reservaId, momento });
    setChecklists((l) => [c, ...l]);
    const antes = estadoDe(reservaId);
    if (antes) { const depois = estadoAposChecklist(antes, momento); if (depois !== antes) { aoMudarReserva(reservaId, depois); toast(`Checklist salvo. A reserva passou para ${depois === "em_uso" ? "Em uso" : "Concluído"}.`); return; } }
    toast("Checklist salvo");
  };
  /** O mesmo checklist para vários carros de uma vez: o banco já põe cada reserva em uso (ou concluída) e registra no histórico do carro. */
  const salvarEmMassa = async (reservaIds: string[], momento: Momento, dados: Omit<ChecklistNovo, "reserva_id" | "momento" | "km">) => {
    const novos = await criarChecklistsEmMassa(reservaIds, momento, dados);
    setChecklists((l) => [...novos, ...l]);
    for (const c of novos) { const antes = estadoDe(c.reserva_id); if (antes) { const depois = estadoAposChecklist(antes, momento); if (depois !== antes) aoMudarReserva(c.reserva_id, depois); } }
    toast(`Checklist de ${momento === "saida" ? "envio" : "retorno"} registrado para ${novos.length} carro${novos.length === 1 ? "" : "s"}`);
  };
  return { checklists, salvar, salvarEmMassa };
}
