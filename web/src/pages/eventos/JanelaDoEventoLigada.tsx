import type { useDadosDeEventos } from "./useDadosDeEventos";
import { JanelaDoEvento, type AbaDoEvento } from "./JanelaDoEvento";

/** O painel do evento ligado aos dados e ações (usado pela tela Eventos e pelo painel aberto por cima de outras páginas). */
export function JanelaDoEventoLigada({ d, id, aba, onAba, onFechar, onExcluido }: {
  d: ReturnType<typeof useDadosDeEventos>; id: string | null; aba: AbaDoEvento; onAba: (a: AbaDoEvento) => void; onFechar: () => void; onExcluido: () => void;
}) {
  const evento = id && d.eventos ? (d.eventos.find((x) => x.id === id) ?? null) : null;
  return (
    <JanelaDoEvento evento={evento} aba={aba} onAba={onAba} campos={d.campos} veiculos={d.veiculos} reservas={d.reservas} eventos={d.eventos ?? []} locais={d.locais} desejados={d.desejados} manutencoes={d.manutencoes} tr={d.tr}
      checklists={d.ck.checklists} onSalvarChecklist={d.ck.salvar} onEditarLocal={d.editarLocal} onAdicionarLocais={d.adicionarLocais} onRemoverLocal={d.tirarLocal} onEditarEvento={d.editarEvento}
      onSalvarReserva={d.salvarReserva} onReservar={d.reservar} onRemoverReserva={d.remover} onNaoAtendido={d.marcarNaoAtendido} onAdicionarDesejados={d.adicionarDesejados}
      onExcluir={async (e) => { await d.excluir(e); onExcluido(); }} onFechar={onFechar} />
  );
}
