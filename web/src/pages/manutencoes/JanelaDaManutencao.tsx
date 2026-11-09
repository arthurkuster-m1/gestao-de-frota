import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Trash, X } from "@phosphor-icons/react";
import { Button, Sheet } from "../../ds";
import { CampoEditavel, clicarNaLinha } from "../../components/motor/CampoEditavel";
import { formatar } from "../../components/motor/formatar";
import type { CampoDaTela } from "../../components/motor/tipos";
import { useEdicao, type OnEditar } from "../../components/motor/useEdicao";
import type { Manutencao } from "../../lib/manutencoes/tipos";
import "../veiculos/veiculos.css";

/** A janela da manutenção: todos os campos se editam no lugar. */
export function JanelaDaManutencao({ manutencao, campos, onEditar, onExcluir, onFechar }: {
  manutencao: Manutencao | null; campos: readonly CampoDaTela<Manutencao>[]; onEditar: OnEditar<Manutencao>; onExcluir: (m: Manutencao) => Promise<void>; onFechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const ed = useEdicao<Manutencao>((m) => m.id, onEditar);
  const [excluindo, setExcluindo] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const id = manutencao?.id;
  useEffect(() => { const d = ref.current; if (!d) return; if (id && !d.open) d.showModal(); if (!id && d.open) d.close(); }, [id]);
  const editaveis = campos.filter((c) => c.edicao).map((c) => c.id);

  return (
    <dialog ref={ref} className="mt-janela" aria-label={`Manutenção ${manutencao?.nome ?? ""}`} onClose={(e) => { if (e.target === e.currentTarget) onFechar(); }} onClick={(e) => { if (e.target === ref.current) onFechar(); }}>
      {manutencao && (
        <div className="mt-janela__corpo" data-testid="janela-manutencao">
          <header className="mt-janela__topo">
            <div><h2 className="t-h2" data-testid="titulo-janela">{manutencao.nome}</h2><div className="mt-janela__sub">{formatar(campos.find((c) => c.id === "status")!, manutencao)}</div></div>
            <button type="button" className="mt-janela__fechar" aria-label="Fechar" onClick={onFechar}><X size={22} /></button>
          </header>
          <div className="mt-janela__conteudo">
            {(ed.erro || falha) && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{ed.erro ?? falha}</span><button type="button" aria-label="Fechar aviso" onClick={() => { ed.setErro(null); setFalha(null); }}><X size={16} /></button></p>}
            <dl className="mt-ficha" data-testid="ficha-dados">
              {campos.map((c) => (
                <div key={c.id} className="mt-ficha__linha" onClick={clicarNaLinha}><dt>{c.titulo}</dt><dd>{c.id === "veiculo" ? <Link to={`/veiculos/${manutencao.veiculo_id}`} className="mt-reserva__evento">{formatar(c, manutencao)}</Link> : <CampoEditavel linha={manutencao} campo={c} ed={ed} navegaveis={editaveis} />}</dd></div>
              ))}
            </dl>
            <div><Button variant="danger" icon={<Trash size={18} />} onClick={() => setExcluindo(true)} data-testid="excluir-manutencao">Excluir manutenção</Button></div>
          </div>
          <Sheet open={excluindo} onClose={() => setExcluindo(false)} title="Excluir manutenção">
            <div className="ds-stack">
              <p className="t-body">Excluir <b>{manutencao.nome}</b>? O histórico do carro continua com o registro de que ela existiu. Não dá para desfazer.</p>
              <Button variant="danger" size="lg" block onClick={() => void onExcluir(manutencao).then(() => setExcluindo(false)).catch((e: Error) => { setFalha(e.message); setExcluindo(false); })} data-testid="confirmar-exclusao">Excluir manutenção</Button>
            </div>
          </Sheet>
        </div>
      )}
    </dialog>
  );
}
