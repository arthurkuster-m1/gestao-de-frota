import { useState, type ReactNode } from "react";
import { CalendarPlus, NotePencil, Wrench } from "@phosphor-icons/react";
import { Button, Sheet } from "../../ds";
import type { AnotacaoDoCarro, Evento } from "../../lib/eventos/tipos";
import { AdicionarVeiculos } from "../eventos/AdicionarVeiculos";
import { NovoEvento } from "../eventos/NovoEvento";
import type { useDadosDeEventos } from "../eventos/useDadosDeEventos";
import { NovaManutencao } from "../manutencoes/NovaManutencao";
import { AnotacaoDoCarroSheet } from "./AnotacaoDoCarroSheet";

type Dados = ReturnType<typeof useDadosDeEventos>;
type Local = { veiculoId: string; data: string };

/**
 * Duplo clique num dia da linha do tempo de um carro: "o que criar aqui?" (evento, manutenção ou anotação do carro) e todos os
 * formulários desse caminho. Usado pelo Planejamento e pela visão Linha do tempo de Veículos. `dialogos` vai solto dentro da tela.
 */
export function useCriacaoNaLinha(d: Dados, aoCriarEvento?: (e: Evento) => void) {
  const [noDia, setNoDia] = useState<Local | null>(null);
  const [manut, setManut] = useState<Local | null>(null);
  const [nota, setNota] = useState<Local | null>(null);
  const [editandoNota, setEditandoNota] = useState<AnotacaoDoCarro | null>(null);
  const [evento, setEvento] = useState<Local | null>(null);       // novo evento a partir deste carro/dia
  const [eventoNovo, setEventoNovo] = useState<Evento | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);

  const nomeDoCarro = (id: string | null | undefined) => { const v = d.veiculos.find((x) => x.id === id); return v ? (v.codigo ?? v.modelo.toUpperCase()) : "?"; };

  const dialogos: ReactNode = (
    <>
      <Sheet open={!!noDia} onClose={() => setNoDia(null)} title="Criar neste dia">
        {noDia && (
          <div className="ds-stack" data-testid="criar-no-dia">
            <p className="t-body-sm t-muted"><b>{nomeDoCarro(noDia.veiculoId)}</b> · {noDia.data.split("-").reverse().join("/")}</p>
            <Button size="lg" block icon={<CalendarPlus size={20} />} data-testid="criar-evento-no-dia" onClick={() => { setEvento(noDia); setNoDia(null); }}>Novo evento com este carro</Button>
            <Button size="lg" block variant="secondary" icon={<Wrench size={20} />} data-testid="criar-manutencao-no-dia" onClick={() => { setManut(noDia); setNoDia(null); }}>Nova manutenção</Button>
            <Button size="lg" block variant="secondary" icon={<NotePencil size={20} />} data-testid="criar-anotacao-no-dia" onClick={() => { setNota(noDia); setNoDia(null); }}>Nova anotação do carro</Button>
          </div>
        )}
      </Sheet>
      <NovoEvento aberto={!!evento} onFechar={() => setEvento(null)} onCriar={d.criar}
        onCriado={(e) => { setMarcados(evento ? [evento.veiculoId] : []); setEventoNovo(e); aoCriarEvento?.(e); }} />
      {eventoNovo && <AdicionarVeiculos aberto onFechar={() => setEventoNovo(null)} evento={d.eventos?.find((x) => x.id === eventoNovo.id) ?? eventoNovo} veiculos={d.veiculos} reservas={d.reservas} eventos={d.eventos ?? []} manutencoes={d.manutencoes}
        pedidos={d.desejados} onNaoAtendido={d.marcarNaoAtendido} veiculosIniciais={marcados} dataInicial={evento?.data ?? null} onReservar={(ids, ini, fim, janela) => d.reservar(eventoNovo.id, ids, ini, fim, janela)} />}
      <NovaManutencao aberto={!!manut} onFechar={() => setManut(null)} veiculos={d.veiculos} veiculoInicial={manut?.veiculoId} dataInicial={manut?.data} onCriar={d.criarDeManutencao} />
      <AnotacaoDoCarroSheet aberto={!!nota || !!editandoNota} onFechar={() => { setNota(null); setEditandoNota(null); }} carro={nomeDoCarro(editandoNota?.veiculo_id ?? nota?.veiculoId)}
        veiculoId={nota?.veiculoId ?? null} dataInicial={nota?.data ?? null} anotacao={editandoNota} onCriar={d.criarNota} onExcluir={d.excluirNota} onEditar={d.editarNota} />
    </>
  );
  return { abrirNoDia: (veiculoId: string, data: string) => setNoDia({ veiculoId, data }), editarNota: (id: string) => setEditandoNota(d.anotacoes.find((n) => n.id === id) ?? null), dialogos };
}
