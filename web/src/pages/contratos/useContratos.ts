import { useVersaoDosDados } from "../../lib/sincronia";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../ds";
import type { OnEditar } from "../../components/motor/useEdicao";
import { adicionarCarroAoContrato, atualizarAditivo, atualizarContrato, criarAditivo, criarContrato, excluirAditivo, excluirContrato, listarAditivos, listarCarrosDosAditivos, listarCarrosDosContratos, listarContratos, tirarCarroDoContrato } from "../../lib/contratos/dados";
import { carrosEmVigor, vigenciaEmVigor } from "../../lib/contratos/regras";
import { montarSnapshotDoContrato, vigenciaDoEvento, type EntradaDoSnapshot } from "../../lib/contratos/montar";
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
  const versao = useVersaoDosDados();
  useEffect(() => {
    Promise.all([listarContratos(), listarCarrosDosContratos(), listarAditivos(), listarCarrosDosAditivos()]).then(([c, v, a, i]) => { setContratos(c); setCarros(v); setAditivos(a); setItens(i); setCarregado(true); }, (e: Error) => { setErro(e.message); setCarregado(true); });
  }, [versao]);

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
  /** Contrato nascido no evento: cliente do evento, vigência que engloba o evento e os carros reservados; o documento já fica "congelado" em snapshot. */
  const criarDoEvento = async (e: Omit<EntradaDoSnapshot, "vigencia" | "carroIds"> & { carroIds?: string[] }): Promise<Contrato> => {
    const ativas = e.reservas.filter((r) => r.estado !== "cancelado");
    const carroIds = e.carroIds ?? [...new Set(ativas.map((r) => r.veiculo_id))];
    const vigencia = vigenciaDoEvento(e.evento, e.reservas);
    const snapshot = await montarSnapshotDoContrato({ ...e, carroIds, vigencia });
    return criar({ evento_id: e.evento.id, cliente_id: e.clienteId, vigencia_inicio: vigencia.inicio, vigencia_fim: vigencia.fim, snapshot: snapshot as unknown as Record<string, unknown> }, carroIds);
  };
  /** Enquanto NÃO assinado, o contrato acompanha o evento: cliente, vigência e carros. Devolve true se mudou algo. */
  const sincronizar = async (c: Contrato, e: Omit<EntradaDoSnapshot, "vigencia" | "carroIds" | "clienteId"> & { clienteId: string }): Promise<boolean> => {
    if (c.status === "assinado" || c.status === "encerrado") return false;
    const ativas = e.reservas.filter((r) => r.estado !== "cancelado");
    const desejados = new Set(ativas.map((r) => r.veiculo_id));
    const vigencia = vigenciaDoEvento(e.evento, e.reservas);
    const atuais = carros.filter((v) => v.contrato_id === c.id);
    const faltam = [...desejados].filter((id) => !atuais.some((v) => v.veiculo_id === id));
    const sobram = atuais.filter((v) => !desejados.has(v.veiculo_id));
    const mudouCampos = c.cliente_id !== e.clienteId || (vigencia.inicio ?? null) !== c.vigencia_inicio || (vigencia.fim ?? null) !== c.vigencia_fim;
    if (!mudouCampos && !faltam.length && !sobram.length && c.snapshot) return false;
    for (const id of faltam) await incluirCarro(c.id, id);
    for (const v of sobram) await tirarCarro(v);
    const snapshot = await montarSnapshotDoContrato({ ...e, carroIds: [...desejados], vigencia });
    const n = await atualizarContrato(c.id, { cliente_id: e.clienteId, vigencia_inicio: vigencia.inicio, vigencia_fim: vigencia.fim, snapshot: snapshot as unknown as Record<string, unknown> });
    setContratos((l) => l.map((x) => (x.id === n.id ? n : x)));
    return true;
  };
  const incluirCarro = async (contratoId: string, veiculoId: string) => { const v = await adicionarCarroAoContrato(contratoId, veiculoId); setCarros((l) => [...l, v]); };
  const tirarCarro = async (v: ContratoVeiculo) => { await tirarCarroDoContrato(v.id); setCarros((l) => l.filter((x) => x.id !== v.id)); };
  const novoAditivo = async (a: AditivoNovo, linhas: { veiculo_id: string; acao: "sai" | "entra" }[]): Promise<Aditivo> => {
    const r = await criarAditivo(a, linhas); setAditivos((l) => [...l, r.aditivo]); setItens((l) => [...l, ...r.itens]); toast("Aditivo criado"); return r.aditivo;
  };
  const editarAditivo: OnEditar<Aditivo> = async (linha, campo, valor) => { const n = await atualizarAditivo(linha.id, { [campo.edicao!.coluna]: valor } as never); setAditivos((l) => l.map((x) => (x.id === n.id ? n : x))); };
  const tirarAditivo = async (a: Aditivo) => { await excluirAditivo(a.id); setAditivos((l) => l.filter((x) => x.id !== a.id)); setItens((l) => l.filter((x) => x.aditivo_id !== a.id)); toast("Aditivo excluído"); };
  return { contratos, carros, aditivos, itens, carregado, erro, emVigor, editar, criar, criarDoEvento, sincronizar, excluir, incluirCarro, tirarCarro, novoAditivo, editarAditivo, tirarAditivo };
}
