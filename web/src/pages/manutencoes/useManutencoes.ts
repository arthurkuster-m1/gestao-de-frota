import { useVersaoDosDados } from "../../lib/sincronia";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../ds";
import type { OnEditar } from "../../components/motor/useEdicao";
import type { ModoDeArrasto } from "../../lib/linhaDoTempo/tipos";
import { atualizarManutencao, criarManutencao, excluirManutencao, listarManutencoes } from "../../lib/manutencoes/dados";
import { manutencoesPorVeiculo, reajustarManutencao } from "../../lib/manutencoes/regras";
import type { Manutencao, ManutencaoNova } from "../../lib/manutencoes/tipos";
import { hojeLocal } from "../../lib/motor/datas";

/** As manutenções e as ações sobre elas. Sem a migration 0008 a lista fica vazia e o resto do app segue funcionando. */
export function useManutencoes() {
  const toast = useToast();
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const versao = useVersaoDosDados();
  useEffect(() => { listarManutencoes().then(setManutencoes, (e: Error) => { setManutencoes([]); setErro(e.message); }); }, [versao]);

  const doCarro = useMemo(() => manutencoesPorVeiculo(manutencoes), [manutencoes]);
  const editar: OnEditar<Manutencao> = async (linha, campo, valor) => {
    const nova = await atualizarManutencao(linha.id, { [campo.edicao!.coluna]: valor } as Partial<ManutencaoNova>);
    setManutencoes((l) => l.map((x) => (x.id === linha.id ? nova : x)));
  };
  const criar = async (m: ManutencaoNova): Promise<Manutencao> => {
    const criada = await criarManutencao(m);
    setManutencoes((l) => [criada, ...l]); toast("Manutenção criada");
    return criada;
  };
  const excluir = async (m: Manutencao) => { await excluirManutencao(m.id); setManutencoes((l) => l.filter((x) => x.id !== m.id)); toast("Manutenção excluída"); };
  /** Arrastar a barra de uma manutenção muda as datas dela. */
  const mover = async (id: string, modo: ModoDeArrasto, delta: number) => {
    const m = manutencoes.find((x) => x.id === id); if (!m) return;
    const n = reajustarManutencao(m, modo, delta, hojeLocal());
    if (n.data_inicio === m.data_inicio && n.data_fim === m.data_fim) return;
    const nova = await atualizarManutencao(m.id, n);
    setManutencoes((l) => l.map((x) => (x.id === m.id ? nova : x)));
  };
  return { manutencoes, doCarro, erro, editar, criar, excluir, mover };
}
