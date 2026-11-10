import { useEffect, useSyncExternalStore } from "react";
import { listarClientes } from "../../lib/clientes/dados";
import { alertasDeContratos, type AlertaDeContrato } from "../../lib/contratos/alertas";
import { listarAditivos, listarCarrosDosAditivos, listarCarrosDosContratos, listarContratos } from "../../lib/contratos/dados";
import { listarEventos, listarReservas } from "../../lib/eventos/dados";
import { useVersaoDosDados } from "../../lib/sincronia";
import { listarVeiculos } from "../../lib/veiculos/dados";

/** Os contratos com dados divergentes do evento, calculados uma vez só para o app todo (Início, evento, carro, contrato e notificação leem daqui). */
let alertas: AlertaDeContrato[] = [];
let carregadoPara = -1, emCurso = false, timer: ReturnType<typeof setTimeout> | undefined;
const ouvintes = new Set<() => void>();
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

async function carregar(versao: number) {
  if (emCurso) return; emCurso = true; carregadoPara = versao;
  try {
    const [contratos, carros, aditivos, itens, eventos, reservas, veiculos, clientes] = await Promise.all([listarContratos(), listarCarrosDosContratos(), listarAditivos(), listarCarrosDosAditivos(), listarEventos(), listarReservas(), listarVeiculos(), listarClientes()]);
    alertas = alertasDeContratos({ contratos, carros, aditivos, itens, eventos, reservas, veiculos, clientes: new Map(clientes.map((c) => [c.id, c.nome])) });
  } catch { alertas = []; }   // sem a migration dos contratos (ou sem rede) simplesmente não há alerta
  emCurso = false; ouvintes.forEach((f) => f());
}

export function useDivergenciasDeContratos(): AlertaDeContrato[] {
  const versao = useVersaoDosDados();
  useEffect(() => {
    if (carregadoPara === versao) return;
    clearTimeout(timer); timer = setTimeout(() => void carregar(versao), carregadoPara < 0 ? 0 : 1500);   // várias gravações seguidas viram uma conferência só
  }, [versao]);
  return useSyncExternalStore(assinar, () => alertas);
}
