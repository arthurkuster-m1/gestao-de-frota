import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../ds";
import type { OnEditar } from "../../components/motor/useEdicao";
import { adicionarCarroAoContrato, atualizarAditivo, atualizarContrato, criarAditivo, criarContrato, excluirAditivo, excluirContrato, listarAditivos, listarCarrosDosAditivos, listarCarrosDosContratos, listarContratos, tirarCarroDoContrato } from "../../lib/contratos/dados";
import { carrosEmVigor, vigenciaEmVigor } from "../../lib/contratos/regras";
import type { Aditivo, AditivoNovo, AditivoVeiculo, Contrato, ContratoNovo, ContratoVeiculo } from "../../lib/contratos/tipos";

/** Contratos, carros, aditivos e o que está em vigor. Sem a migration 0011 tudo fica vazio e o aviso explica. */
export function useContratos() {
  const toast = useToast();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [carros, setCarros] = useState<ContratoVeiculo[]>([]);
  const [aditivos, setAditivos] = useState<Aditivo[]>([]);
  const [itens, setItens] = useState<AditivoVeiculo[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([listarContratos(), listarCarrosDosContratos(), listarAditivos(), listarCarrosDosAditivos()]).then(([c, v, a, i]) => { setContratos(c); setCarros(v); setAditivos(a); setItens(i); setCarregado(true); }, (e: Error) => { setErro(e.message); setCarregado(true); });
  }, []);

  /** Por contrato: a vigência e os carros EM VIGOR (calculados, nunca gravados). */
  const emVigor = useMemo(() => {
    const m = new Map<string, { vigencia: { inicio: string | null; fim: string | null }; carros: Set<string>; aditivos: Aditivo[] }>();
    for (const c of contratos) {
      const ads = aditivos.filter((a) => a.contrato_id === c.id);
      m.set(c.id, { vigencia: vigenciaEmVigor(c, ads), carros: carrosEmVigor(carros.filter((v) => v.contrato_id === c.id), ads, itens), aditivos: ads });
    }
    return m;
  }, [contratos, carros, aditivos, itens]);

  const editar: OnEditar<Contrato> = async (linha, campo, valor) => { const n = await atualizarContrato(linha.id, { [campo.edicao!.coluna]: valor } as never); setContratos((l) => l.map((x) => (x.id === n.id ? n : x))); };
  const criar = async (c: ContratoNovo, veiculoIds: string[]): Promise<Contrato> => {
    const r = await criarContrato(c, veiculoIds); setContratos((l) => [r.contrato, ...l]); setCarros((l) => [...l, ...r.carros]); toast("Contrato criado"); return r.contrato;
  };
  const excluir = async (c: Contrato) => { await excluirContrato(c.id); const ids = new Set(aditivos.filter((a) => a.contrato_id === c.id).map((a) => a.id)); setContratos((l) => l.filter((x) => x.id !== c.id)); setCarros((l) => l.filter((x) => x.contrato_id !== c.id)); setAditivos((l) => l.filter((x) => x.contrato_id !== c.id)); setItens((l) => l.filter((x) => !ids.has(x.aditivo_id))); toast("Contrato excluído"); };
  const incluirCarro = async (contratoId: string, veiculoId: string) => { const v = await adicionarCarroAoContrato(contratoId, veiculoId); setCarros((l) => [...l, v]); };
  const tirarCarro = async (v: ContratoVeiculo) => { await tirarCarroDoContrato(v.id); setCarros((l) => l.filter((x) => x.id !== v.id)); };
  const novoAditivo = async (a: AditivoNovo, linhas: { veiculo_id: string; acao: "sai" | "entra" }[]): Promise<Aditivo> => {
    const r = await criarAditivo(a, linhas); setAditivos((l) => [...l, r.aditivo]); setItens((l) => [...l, ...r.itens]); toast("Aditivo criado"); return r.aditivo;
  };
  const editarAditivo: OnEditar<Aditivo> = async (linha, campo, valor) => { const n = await atualizarAditivo(linha.id, { [campo.edicao!.coluna]: valor } as never); setAditivos((l) => l.map((x) => (x.id === n.id ? n : x))); };
  const tirarAditivo = async (a: Aditivo) => { await excluirAditivo(a.id); setAditivos((l) => l.filter((x) => x.id !== a.id)); setItens((l) => l.filter((x) => x.aditivo_id !== a.id)); toast("Aditivo excluído"); };
  return { contratos, carros, aditivos, itens, carregado, erro, emVigor, editar, criar, excluir, incluirCarro, tirarCarro, novoAditivo, editarAditivo, tirarAditivo };
}
