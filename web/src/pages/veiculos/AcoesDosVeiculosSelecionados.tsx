import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarBlank, CalendarPlus, Copy, Receipt, ArrowUUpLeft, Trash } from "@phosphor-icons/react";
import { Button, Sheet, useToast } from "../../ds";
import { hojeLocal } from "../../lib/motor/datas";
import type { Evento } from "../../lib/eventos/tipos";
import { copiarTabela, tabelaDeVeiculosParaOutlook } from "../../lib/eventos/linhasDoEvento";
import { atualizarCampos } from "../../lib/veiculos/dados";
import { AdicionarVeiculos } from "../eventos/AdicionarVeiculos";
import { ExcluirVeiculos } from "./ExcluirVeiculos";
import type { useDadosDeEventos } from "../eventos/useDadosDeEventos";

/**
 * O leque que abre ao selecionar veículos: adicionar em evento, ver no Planejamento, marcar para devolução e marcar como faturados.
 * ("Filtrar seleção" e "Limpar" já vêm na barra da tela.)
 */
export function AcoesDosVeiculosSelecionados({ d, ids, limpar, semPlanejamento }: { d: ReturnType<typeof useDadosDeEventos>; ids: string[]; limpar: () => void; semPlanejamento?: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [escolhendo, setEscolhendo] = useState(false);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function marcar(patch: Parameters<typeof atualizarCampos>[1], texto: string) {
    setOcupado(true);
    try { for (const id of ids) await atualizarCampos(id, patch); toast(`${ids.length} veículo${ids.length === 1 ? "" : "s"} ${texto}`); limpar(); }
    catch (e) { toast(`Não consegui: ${(e as Error).message}`); } finally { setOcupado(false); }
  }

  async function copiar() {
    const lista = ids.map((id) => d.veiculos.find((v) => v.id === id)).filter((v): v is NonNullable<typeof v> => !!v);
    toast((await copiarTabela(tabelaDeVeiculosParaOutlook(lista))) ? `Tabela de ${lista.length} veículo${lista.length === 1 ? "" : "s"} copiada: cole no Outlook` : "Não consegui copiar. Libere a área de transferência no navegador.");
  }
  return (
    <>
      <Button size="sm" variant="secondary" icon={<Copy size={16} />} onClick={() => void copiar()} data-testid="sel-copiar">Copiar tabela</Button>
      <Button size="sm" variant="secondary" icon={<CalendarPlus size={16} />} onClick={() => setEscolhendo(true)} data-testid="sel-adicionar-evento">Adicionar em evento</Button>
      {!semPlanejamento && <Button size="sm" variant="secondary" icon={<CalendarBlank size={16} />} onClick={() => navigate(`/planejamento?veiculos=${ids.join(",")}`)} data-testid="sel-ver-planejamento">Visualizar no Planejamento</Button>}
      <Button size="sm" variant="secondary" icon={<ArrowUUpLeft size={16} />} loading={ocupado} onClick={() => void marcar({ status_ciclo: "em_devolucao" }, "marcado(s) para devolução")} data-testid="sel-devolucao">Marcar para Devolução</Button>
      <Button size="sm" variant="secondary" icon={<Receipt size={16} />} loading={ocupado} onClick={() => void marcar({ data_faturamento: hojeLocal() }, "marcado(s) como faturado(s)")} data-testid="sel-faturado">Marcar como Faturado(s)</Button>

      <Button size="sm" variant="danger" icon={<Trash size={16} />} onClick={() => setExcluindo(true)} data-testid="sel-excluir">Excluir</Button>
      <ExcluirVeiculos aberto={excluindo} onFechar={() => setExcluindo(false)} veiculos={d.veiculos.filter((v) => ids.includes(v.id))}
        consequencias={{ reservas: [...d.reservas, ...d.reservasSemData].filter((r) => ids.includes(r.veiculo_id)).length, manutencoes: d.manutencoes.filter((m) => ids.includes(m.veiculo_id)).length }} onExcluido={limpar} />
      <Sheet open={escolhendo} onClose={() => setEscolhendo(false)} title="Adicionar em qual evento?">
        <div className="ds-stack" data-testid="escolher-evento">
          <p className="t-body-sm t-muted">{ids.length} veículo{ids.length === 1 ? "" : "s"} selecionado{ids.length === 1 ? "" : "s"}. Escolha o evento; na próxima janela você confere as datas e confirma.</p>
          {(d.eventos ?? []).length === 0 && <p className="t-body t-muted">Nenhum evento ainda. Crie um em Eventos.</p>}
          <ul className="mt-escolha" role="list">
            {(d.eventos ?? []).map((e) => <li key={e.id} className="mt-escolha__item"><button type="button" className="mt-escolha__linha" style={{ width: "100%", textAlign: "left", background: "transparent", border: 0, font: "inherit", color: "inherit", cursor: "pointer" }} onClick={() => { setEvento(e); setEscolhendo(false); }}><span className="mt-escolha__nome">{e.nome}</span></button></li>)}
          </ul>
        </div>
      </Sheet>
      {evento && <AdicionarVeiculos aberto onFechar={() => { setEvento(null); limpar(); }} evento={d.eventos?.find((x) => x.id === evento.id) ?? evento} veiculos={d.veiculos} reservas={d.reservas} eventos={d.eventos ?? []} manutencoes={d.manutencoes}
        pedidos={d.desejados} onNaoAtendido={d.marcarNaoAtendido} veiculosIniciais={ids} dataInicial={null} onReservar={(vs, ini, fim, janela) => d.reservar(evento.id, vs, ini, fim, janela)} />}
    </>
  );
}
