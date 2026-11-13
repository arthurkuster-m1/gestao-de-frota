import { useVersaoDosDados } from "../../lib/sincronia";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../ds";
import type { OnEditar } from "../../components/motor/useEdicao";
import { hojeLocal } from "../../lib/motor/datas";
import { reservasPorVeiculo } from "../../lib/eventos/uso";
import { avisoDoCicloAutomatico } from "../../lib/veiculos/ciclo";
import { atualizarCampos, listarVeiculos } from "../../lib/veiculos/dados";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { useDadosDeEventos } from "../eventos/useDadosDeEventos";
import { JanelaDoVeiculo } from "./JanelaDoVeiculo";
import { camposDoVeiculo, type ContextoDeUso } from "./Veiculos";

/** O painel do veículo aberto POR CIMA de outra página (ex.: a partir de um evento), com os mesmos dados e edições da tela Veículos. */
export function VeiculoNoLugar({ id, onFechar }: { id: string; onFechar: () => void }) {
  const toast = useToast();
  const d = useDadosDeEventos();
  const [lista, setLista] = useState<Veiculo[] | null>(null);
  const versao = useVersaoDosDados();
  useEffect(() => { listarVeiculos().then(setLista, () => setLista([])); }, [versao]);
  const nomes = useMemo(() => new Map((d.eventos ?? []).map((e) => [e.id, e.nome])), [d.eventos]);
  const ctx = useMemo<ContextoDeUso>(() => ({ reservas: reservasPorVeiculo(d.reservas), nomeDoEvento: (x) => nomes.get(x) ?? "?", carregado: d.eventos !== null, hoje: hojeLocal(), manutencoes: d.manutencoesDoCarro }), [d.reservas, d.eventos, nomes, d.manutencoesDoCarro]);
  const campos = useMemo(() => camposDoVeiculo(ctx), [ctx]);
  const veiculo = lista?.find((x) => x.id === id) ?? null;
  useEffect(() => { if (lista && !veiculo) onFechar(); }, [lista, veiculo, onFechar]);
  const editar: OnEditar<Veiculo> = async (linha, campo, valor) => {
    const novo = await atualizarCampos(linha.id, { [campo.edicao!.coluna]: valor } as Partial<Veiculo>);
    setLista((l) => (l ?? []).map((x) => (x.id === linha.id ? novo : x)));
    const aviso = avisoDoCicloAutomatico(linha, novo, campo.edicao!.coluna);
    if (aviso) toast(aviso);
  };
  return <JanelaDoVeiculo onSalvarReserva={d.salvarReserva} reservasSemData={veiculo ? d.reservasSemData.filter((r) => r.veiculo_id === veiculo.id) : []} clientes={new Map(d.clientes.map((c) => [c.id, c.nome]))} locais={d.locais} veiculo={veiculo} campos={campos} onEditar={editar} onFechar={onFechar} reservas={veiculo ? (ctx.reservas.get(veiculo.id) ?? []) : []} eventos={d.eventos ?? []} usoCarregado={ctx.carregado}
    manutencoes={veiculo ? (d.manutencoesDoCarro.get(veiculo.id) ?? []) : []} manutencoesErro={null} onCriarManutencao={d.criarDeManutencao} />;
}
