import { useVersaoDosDados } from "../../lib/sincronia";
import { useEffect, useState } from "react";
import { useToast } from "../../ds";
import { atualizarChecklist, criarChecklist, listarChecklists } from "../../lib/checklists/dados";
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
  return { checklists, salvar };
}
