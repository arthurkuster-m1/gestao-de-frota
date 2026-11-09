import { useState } from "react";
import { useToast } from "../../ds";
import type { Evento, EventoLocal, Reserva } from "../../lib/eventos/tipos";
import { distanciaEntre, rotaDoTransporte } from "../../lib/transportes/rota";
import { reservasDoTransporte } from "../../lib/transportes/regras";
import type { Transporte } from "../../lib/transportes/tipos";
import type { useTransportes } from "./useTransportes";

type Tr = ReturnType<typeof useTransportes>;

/** Puxa a rota do evento para o transporte e calcula os quilômetros. */
export function useRotasDosTransportes({ tr, eventos, reservas, locais }: { tr: Tr; eventos: Evento[]; reservas: Reserva[]; locais: EventoLocal[] }) {
  const toast = useToast();
  const [calculando, setCalculando] = useState(false);

  /** Refaz origem, destino e km de UM transporte a partir do evento (e do carro, se ele tem origem ou endereço próprios). */
  async function atualizar(t: Transporte): Promise<string> {
    const evento = eventos.find((e) => e.id === t.evento_id);
    if (!evento) throw new Error("O evento deste transporte não foi encontrado.");
    const ids = reservasDoTransporte(t, tr.vinculos);
    const reserva = reservas.find((r) => ids.includes(r.id)) ?? reservas.find((r) => r.evento_id === t.evento_id && r.estado !== "cancelado");
    const rota = rotaDoTransporte(t.sentido, reserva, evento, locais.filter((l) => l.evento_id === t.evento_id));
    if (!rota.origem || !rota.destino) { await tr.gravarRota(t, { origem: rota.origem, destino: rota.destino, distancia_km: t.distancia_km }); return `Faltou ${!rota.origem ? "a origem" : "o endereço de chegada"} no evento; preencha lá e atualize de novo.`; }
    const dist = await distanciaEntre(rota.origem, rota.destino);
    await tr.gravarRota(t, { origem: rota.origem, destino: rota.destino, distancia_km: dist ? dist.km : t.distancia_km });
    if (!dist) return "Rota puxada do evento, mas não consegui medir a distância (endereço não encontrado ou sem internet).";
    return dist.metodo === "rota" ? `≈ ${dist.km} km de estrada.` : `≈ ${dist.km} km (estimado em linha reta, o serviço de rotas não respondeu).`;
  }

  /** Os transportes sem origem, destino ou km ganham a rota do evento, um de cada vez. */
  async function calcularPendentes() {
    const faltam = tr.transportes.filter((t) => t.modalidade !== "retirada" && (!t.origem || !t.destino || t.distancia_km === null));
    if (faltam.length === 0) { toast("Todas as rotas já estão calculadas"); return; }
    setCalculando(true); let ok = 0;
    try { for (const t of faltam) { try { const m = await atualizar(t); if (m.startsWith("≈")) ok++; } catch { /* segue para o próximo */ } } }
    finally { setCalculando(false); }
    toast(`${ok} de ${faltam.length} rotas calculadas`);
  }
  return { atualizar, calcularPendentes, calculando };
}
