import { useMemo } from "react";
import { reservasPorVeiculo } from "../../lib/eventos/uso";
import { useDadosDeEventos } from "../eventos/useDadosDeEventos";
import { camposDaManutencao, type ContextoDeManutencoes } from "./camposDaManutencao";
import { JanelaDaManutencao } from "./JanelaDaManutencao";

/** A janela da manutenção aberta POR CIMA de outra página (ex.: a ficha do veículo): ao fechar, a pessoa continua onde estava. */
export function ManutencaoNoLugar({ id, onFechar }: { id: string; onFechar: () => void }) {
  const d = useDadosDeEventos();
  const nomes = useMemo(() => new Map((d.eventos ?? []).map((e) => [e.id, e.nome])), [d.eventos]);
  const ctx = useMemo<ContextoDeManutencoes>(() => ({ veiculos: new Map(d.veiculos.map((v) => [v.id, v])), reservasDoCarro: reservasPorVeiculo(d.reservas), nomeDoEvento: (x) => nomes.get(x) ?? "?", carregado: d.eventos !== null }), [d.veiculos, d.reservas, nomes, d.eventos]);
  const campos = useMemo(() => camposDaManutencao(ctx), [ctx]);
  const aberta = d.eventos !== null ? (d.manutencoes.find((x) => x.id === id) ?? null) : null;
  return <JanelaDaManutencao manutencao={aberta} campos={campos} onEditar={d.editarManutencao} onExcluir={async (m) => { await d.excluirDeManutencao(m); onFechar(); }} onFechar={onFechar} />;
}
