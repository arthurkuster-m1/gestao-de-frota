import { listarChecklists } from "../checklists/dados";
import { listarClientes } from "../clientes/dados";
import { listarEventos, listarReservas, listarReservasSemData } from "../eventos/dados";
import { listarManutencoes } from "../manutencoes/dados";
import { hojeLocal } from "../motor/datas";
import { listarVeiculos } from "../veiculos/dados";
import type { Dados } from "./tipos";

/** Carrega o que as lançamentos conferem (veículos, eventos, reservas, manutenções, clientes e checklists). O que não existir ainda no banco vem vazio. */
export async function carregarDados(): Promise<Dados> {
  const [veiculos, eventos, reservas, semData, manutencoes, clientes, checklists] = await Promise.all([
    listarVeiculos(), listarEventos(), listarReservas(), listarReservasSemData(), listarManutencoes().catch(() => []), listarClientes().catch(() => []), listarChecklists().catch(() => []),
  ]);
  return { veiculos, eventos, reservas: [...reservas, ...semData], manutencoes, clientes, checklists, hoje: hojeLocal() };
}
