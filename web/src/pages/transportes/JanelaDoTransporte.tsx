import { AlcaDoPainel } from "../../components/motor/AlcaDoPainel";
import { LinkNoLugar } from "../../app/noLugar";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Trash, X } from "@phosphor-icons/react";
import { Button, Sheet } from "../../ds";
import { CampoEditavel, clicarNaLinha } from "../../components/motor/CampoEditavel";
import { formatar } from "../../components/motor/formatar";
import type { CampoDaTela } from "../../components/motor/tipos";
import { useEdicao, type OnEditar } from "../../components/motor/useEdicao";
import type { Reserva } from "../../lib/eventos/tipos";
import { colunaDoSentido } from "../../lib/transportes/regras";
import type { Sentido, Transporte, VinculoDaReserva } from "../../lib/transportes/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";
import "../veiculos/veiculos.css";

/** A janela do transporte: dados editáveis no lugar e, embaixo, quais carros do evento vão nele. */
export function JanelaDoTransporte({ transporte, campos, reservas, veiculos, vinculos, onEditar, onLigar, onAtualizarRota, onExcluir, onFechar }: {
  transporte: Transporte | null; campos: readonly CampoDaTela<Transporte>[]; reservas: Reserva[]; veiculos: Veiculo[]; vinculos: VinculoDaReserva[];
  onAtualizarRota: (t: Transporte) => Promise<string>; onEditar: OnEditar<Transporte>; onLigar: (reservaIds: string[], sentido: Sentido, transporteId: string | null) => Promise<void>; onExcluir: (t: Transporte) => Promise<void>; onFechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const ed = useEdicao<Transporte>((t) => t.id, onEditar);
  const [excluindo, setExcluindo] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const id = transporte?.id;
  useEffect(() => { const d = ref.current; if (!d) return; if (id && !d.open) d.showModal(); if (!id && d.open) d.close(); }, [id]);
  const editaveis = campos.filter((c) => c.edicao).map((c) => c.id);
  const [calculando, setCalculando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  async function atualizarRota() { if (!transporte) return; setCalculando(true); setAviso(null); setFalha(null); try { setAviso(await onAtualizarRota(transporte)); } catch (e) { setFalha((e as Error).message); } finally { setCalculando(false); } }
  const carros = transporte ? reservas.filter((r) => r.evento_id === transporte.evento_id && r.estado !== "cancelado").map((r) => ({ r, v: veiculos.find((x) => x.id === r.veiculo_id), vin: vinculos.find((x) => x.id === r.id) })) : [];
  const ligadoA = (vin: VinculoDaReserva | undefined) => (transporte && vin ? vin[colunaDoSentido(transporte.sentido)] : null);

  async function alternar(reservaId: string, ligar: boolean) {
    if (!transporte) return; setFalha(null);
    try { await onLigar([reservaId], transporte.sentido, ligar ? transporte.id : null); } catch (e) { setFalha((e as Error).message); }
  }

  return (
    <dialog ref={ref} className="mt-janela" aria-label={`Transporte ${transporte?.referencia ?? ""}`} onClose={(e) => { if (e.target === e.currentTarget) onFechar(); }} onClick={(e) => { if (e.target === ref.current) onFechar(); }}>
      {transporte && (
        <div className="mt-janela__corpo" data-testid="janela-transporte">
          <AlcaDoPainel />
          <header className="mt-janela__topo">
            <div><h2 className="t-h2" data-testid="titulo-janela">{transporte.referencia ?? "Transporte sem referência"}</h2><div className="mt-janela__sub">{formatar(campos.find((c) => c.id === "modalidade")!, transporte)}</div></div>
            <button type="button" className="mt-janela__fechar" aria-label="Fechar" onClick={onFechar}><X size={22} /></button>
          </header>
          <div className="mt-janela__conteudo">
            {(ed.erro || falha) && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{ed.erro ?? falha}</span><button type="button" aria-label="Fechar aviso" onClick={() => { ed.setErro(null); setFalha(null); }}><X size={16} /></button></p>}
            <dl className="mt-ficha" data-testid="ficha-dados">
              {campos.filter((c) => c.id !== "carros").map((c) => (
                <div key={c.id} className="mt-ficha__linha" onClick={clicarNaLinha}><dt>{c.titulo}</dt><dd>{c.id === "evento" ? <LinkNoLugar to={`/eventos/${transporte.evento_id}`} className="mt-reserva__evento">{formatar(c, transporte)}</LinkNoLugar> : <CampoEditavel linha={transporte} campo={c} ed={ed} navegaveis={editaveis} />}</dd></div>
              ))}
            </dl>
            <div className="ds-stack">
              <div><Button variant="secondary" icon={<MapPin size={18} />} loading={calculando} onClick={() => void atualizarRota()} data-testid="atualizar-rota">Atualizar rota e distância do evento</Button></div>
              <p className="t-body-sm t-muted">{aviso ?? "Puxa de novo a origem e o endereço do evento e recalcula os km. Os dias de viagem saem de km ÷ 500 (para cima); menos de 200 km é no mesmo dia."}</p>
            </div>
            <h3 className="t-h3">Carros neste transporte ({transporte.sentido})</h3>
            {carros.length === 0 && <p className="t-body t-muted">O evento ainda não tem carros reservados.</p>}
            <ul className="mt-escolha" role="list" data-testid="carros-ligados">
              {carros.map(({ r, v, vin }) => { const lig = ligadoA(vin); const nome = v?.codigo ?? v?.modelo.toUpperCase() ?? "?"; return (
                <li key={r.id} className="mt-escolha__item"><label className="mt-escolha__linha">
                  <input type="checkbox" checked={lig === transporte.id} onChange={(e) => void alternar(r.id, e.target.checked)} aria-label={`${nome} neste transporte`} />
                  <span className="mt-escolha__nome">{nome}</span>
                  {lig && lig !== transporte.id && <span className="t-body-sm t-muted">está em outro transporte (marcar troca)</span>}
                </label></li>
              ); })}
            </ul>
            <div><Button variant="danger" icon={<Trash size={18} />} onClick={() => setExcluindo(true)} data-testid="excluir-transporte">Excluir transporte</Button></div>
          </div>
          <Sheet open={excluindo} onClose={() => setExcluindo(false)} title="Excluir transporte">
            <div className="ds-stack">
              <p className="t-body">Excluir este transporte? Os carros ficam sem transporte de {transporte.sentido}. Não dá para desfazer.</p>
              <Button variant="danger" size="lg" block onClick={() => void onExcluir(transporte).then(() => setExcluindo(false)).catch((e: Error) => { setFalha(e.message); setExcluindo(false); })} data-testid="confirmar-exclusao">Excluir transporte</Button>
            </div>
          </Sheet>
        </div>
      )}
    </dialog>
  );
}
