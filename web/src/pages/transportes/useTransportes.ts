import { useVersaoDosDados } from "../../lib/sincronia";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../ds";
import type { OnEditar } from "../../components/motor/useEdicao";
import { atualizarTransporte, criarTransporte, definirTransporteDasReservas, excluirTransporte, listarTransportes, listarVinculos } from "../../lib/transportes/dados";
import { valorPorEvento, valoresPorEventoESentido } from "../../lib/transportes/regras";
import { planejarCampo, type CampoDeTransporte, type Operacao } from "../../lib/transportes/porCarro";
import type { Sentido, Transporte, TransporteNovo, VinculoDaReserva } from "../../lib/transportes/tipos";

/** Transportes (com rota e pagamento dentro) e quem usa o quê. Sem a migration 0009 tudo fica vazio e o resto do app segue funcionando. */
export function useTransportes() {
  const toast = useToast();
  const [transportes, setTransportes] = useState<Transporte[]>([]);
  const [vinculos, setVinculos] = useState<VinculoDaReserva[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const versao = useVersaoDosDados();
  useEffect(() => {
    Promise.all([listarTransportes(), listarVinculos()]).then(([t, v]) => { setTransportes(t); setVinculos(v); setCarregado(true); }, (e: Error) => { setErro(e.message); setCarregado(true); });
  }, [versao]);

  // espelho síncrono do estado: várias gravações coladas de uma vez (uma fila só) enxergam o resultado das anteriores
  const espelho = useRef({ transportes, vinculos }); espelho.current = { transportes, vinculos };
  const fila = useRef<Promise<void>>(Promise.resolve());
  async function executar(op: Operacao) {
    if (op.tipo === "criar") {
      const criado = await criarTransporte(op.novo);
      espelho.current = { ...espelho.current, transportes: [criado, ...espelho.current.transportes] }; setTransportes((l) => [criado, ...l]);
      if (op.reservaIds.length) { const v = await definirTransporteDasReservas(op.reservaIds, op.novo.sentido, criado.id); espelho.current = { ...espelho.current, vinculos: espelho.current.vinculos.map((x) => v.find((y) => y.id === x.id) ?? x) }; setVinculos((l) => l.map((x) => v.find((y) => y.id === x.id) ?? x)); }
    } else if (op.tipo === "vincular") {
      const v = await definirTransporteDasReservas(op.reservaIds, op.sentido, op.transporteId);
      espelho.current = { ...espelho.current, vinculos: espelho.current.vinculos.map((x) => v.find((y) => y.id === x.id) ?? x) }; setVinculos((l) => l.map((x) => v.find((y) => y.id === x.id) ?? x));
    } else if (op.tipo === "atualizar") {
      // o valor aparece na hora; a gravação confere e, se falhar, volta o anterior
      const antes = espelho.current.transportes.find((x) => x.id === op.id);
      if (antes) { const otimista = { ...antes, ...op.patch } as Transporte; espelho.current = { ...espelho.current, transportes: espelho.current.transportes.map((x) => (x.id === op.id ? otimista : x)) }; setTransportes((l) => l.map((x) => (x.id === op.id ? otimista : x))); }
      let n: Transporte;
      try { n = await atualizarTransporte(op.id, op.patch); }
      catch (e) { if (antes) { espelho.current = { ...espelho.current, transportes: espelho.current.transportes.map((x) => (x.id === op.id ? antes : x)) }; setTransportes((l) => l.map((x) => (x.id === op.id ? antes : x))); } throw e; }
      espelho.current = { ...espelho.current, transportes: espelho.current.transportes.map((x) => (x.id === n.id ? n : x)) }; setTransportes((l) => l.map((x) => (x.id === n.id ? n : x)));
    } else {
      await excluirTransporte(op.id);
      const solta = (v: VinculoDaReserva): VinculoDaReserva => ({ ...v, transporte_ida_id: v.transporte_ida_id === op.id ? null : v.transporte_ida_id, transporte_volta_id: v.transporte_volta_id === op.id ? null : v.transporte_volta_id });
      espelho.current = { transportes: espelho.current.transportes.filter((x) => x.id !== op.id), vinculos: espelho.current.vinculos.map(solta) };
      setTransportes((l) => l.filter((x) => x.id !== op.id)); setVinculos((l) => l.map(solta));
    }
  }
  /** Edita um campo do transporte de um carro (código, modalidade, transportadora, valor, km), na fila; o plano vem do estado de agora. */
  const gravarCampo = (eventoId: string, reservaId: string, sentido: Sentido, campo: CampoDeTransporte, valor: string | number | null, rota: { origem: string | null; destino: string | null }): Promise<void> => {
    const rodar = async () => { for (const op of planejarCampo({ ...espelho.current, eventoId, sentido, reservaId, campo, valor, rota })) await executar(op); };
    const p = fila.current.then(rodar); fila.current = p.catch(() => undefined); return p;
  };

  const valorDoEvento = useMemo(() => valorPorEvento(transportes), [transportes]);
  const valoresDoEvento = useMemo(() => valoresPorEventoESentido(transportes), [transportes]);
  const trocar = <T extends { id: string }>(l: T[], novo: T) => l.map((x) => (x.id === novo.id ? novo : x));

  const editarTransporte: OnEditar<Transporte> = async (linha, campo, valor) => { setTransportes((l) => trocar(l, { ...linha })); const n = await atualizarTransporte(linha.id, { [campo.edicao!.coluna]: valor } as never); setTransportes((l) => trocar(l, n)); };
  const criarT = async (t: TransporteNovo, reservaIds: string[] = []): Promise<Transporte> => {
    const criado = await criarTransporte(t);
    setTransportes((l) => [criado, ...l]);
    if (reservaIds.length) { try { const v = await definirTransporteDasReservas(reservaIds, t.sentido, criado.id); setVinculos((l) => l.map((x) => v.find((y) => y.id === x.id) ?? x)); } catch (e) { toast(`Transporte criado, mas os carros não foram ligados: ${(e as Error).message}`); } }
    toast("Transporte criado");
    return criado;
  };
  const excluirT = async (t: Transporte) => { await excluirTransporte(t.id); setTransportes((l) => l.filter((x) => x.id !== t.id)); setVinculos((l) => l.map((v) => ({ ...v, transporte_ida_id: v.transporte_ida_id === t.id ? null : v.transporte_ida_id, transporte_volta_id: v.transporte_volta_id === t.id ? null : v.transporte_volta_id }))); toast("Transporte excluído"); };
  /** Grava origem, destino e km (puxados do evento) de um transporte; os dias de viagem o banco recalcula. */
  const gravarRota = async (t: Transporte, rota: { origem: string | null; destino: string | null; distancia_km: number | null }) => { const n = await atualizarTransporte(t.id, rota); setTransportes((l) => trocar(l, n)); return n; };
  /** Liga (ou solta) carros a um transporte. Um carro tem um transporte de ida e um de volta. */
  const ligarCarros = async (reservaIds: string[], sentido: Sentido, transporteId: string | null) => {
    const v = await definirTransporteDasReservas(reservaIds, sentido, transporteId);
    setVinculos((l) => l.map((x) => v.find((y) => y.id === x.id) ?? x));
  };

  return { transportes, vinculos, carregado, erro, valorDoEvento, valoresDoEvento, gravarCampo, editarTransporte, criarT, excluirT, ligarCarros, gravarRota };
}
