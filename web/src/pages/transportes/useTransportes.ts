import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../ds";
import type { OnEditar } from "../../components/motor/useEdicao";
import { atualizarPagamento, atualizarTransporte, criarPagamento, criarTransporte, definirTransporteDasReservas, excluirPagamento, excluirTransporte, listarPagamentos, listarTransportes, listarVinculos } from "../../lib/transportes/dados";
import { valorPorEvento } from "../../lib/transportes/regras";
import type { Pagamento, PagamentoNovo, Sentido, Transporte, TransporteNovo, VinculoDaReserva } from "../../lib/transportes/tipos";

/** Transportes, pagamentos e quem usa o quê. Sem a migration 0009 tudo fica vazio e o resto do app segue funcionando. */
export function useTransportes() {
  const toast = useToast();
  const [transportes, setTransportes] = useState<Transporte[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [vinculos, setVinculos] = useState<VinculoDaReserva[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarTransportes(), listarPagamentos(), listarVinculos()]).then(([t, p, v]) => { setTransportes(t); setPagamentos(p); setVinculos(v); setCarregado(true); }, (e: Error) => { setErro(e.message); setCarregado(true); });
  }, []);

  const valorDoEvento = useMemo(() => valorPorEvento(transportes), [transportes]);
  const trocar = <T extends { id: string }>(l: T[], novo: T) => l.map((x) => (x.id === novo.id ? novo : x));

  const editarTransporte: OnEditar<Transporte> = async (linha, campo, valor) => { setTransportes((l) => trocar(l, { ...linha })); const n = await atualizarTransporte(linha.id, { [campo.edicao!.coluna]: valor } as never); setTransportes((l) => trocar(l, n)); };
  const editarPagamento: OnEditar<Pagamento> = async (linha, campo, valor) => { const n = await atualizarPagamento(linha.id, { [campo.edicao!.coluna]: valor } as never); setPagamentos((l) => trocar(l, n)); };
  const criarT = async (t: TransporteNovo, reservaIds: string[] = []): Promise<Transporte> => {
    const criado = await criarTransporte(t);
    setTransportes((l) => [criado, ...l]);
    if (reservaIds.length) { try { const v = await definirTransporteDasReservas(reservaIds, t.sentido, criado.id); setVinculos((l) => l.map((x) => v.find((y) => y.id === x.id) ?? x)); } catch (e) { toast(`Transporte criado, mas os carros não foram ligados: ${(e as Error).message}`); } }
    toast("Transporte criado");
    return criado;
  };
  const criarP = async (p: PagamentoNovo): Promise<Pagamento> => { const c = await criarPagamento(p); setPagamentos((l) => [c, ...l]); toast("Pagamento criado"); return c; };
  const excluirT = async (t: Transporte) => { await excluirTransporte(t.id); setTransportes((l) => l.filter((x) => x.id !== t.id)); setVinculos((l) => l.map((v) => ({ ...v, transporte_ida_id: v.transporte_ida_id === t.id ? null : v.transporte_ida_id, transporte_volta_id: v.transporte_volta_id === t.id ? null : v.transporte_volta_id }))); toast("Transporte excluído"); };
  const excluirP = async (p: Pagamento) => { await excluirPagamento(p.id); setPagamentos((l) => l.filter((x) => x.id !== p.id)); setTransportes((l) => l.map((t) => (t.pagamento_id === p.id ? { ...t, pagamento_id: null } : t))); toast("Pagamento excluído"); };
  /** Liga (ou solta) carros a um transporte. Um carro tem um transporte de ida e um de volta. */
  const ligarCarros = async (reservaIds: string[], sentido: Sentido, transporteId: string | null) => {
    const v = await definirTransporteDasReservas(reservaIds, sentido, transporteId);
    setVinculos((l) => l.map((x) => v.find((y) => y.id === x.id) ?? x));
  };

  return { transportes, pagamentos, vinculos, carregado, erro, valorDoEvento, editarTransporte, editarPagamento, criarT, criarP, excluirT, excluirP, ligarCarros };
}
