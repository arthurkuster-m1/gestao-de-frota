import { useEffect, useRef, useState } from "react";
import { Trash, X } from "@phosphor-icons/react";
import { Button, Sheet } from "../../ds";
import { CampoEditavel } from "../../components/motor/CampoEditavel";
import { formatar } from "../../components/motor/formatar";
import type { CampoDaTela } from "../../components/motor/tipos";
import { useEdicao, type OnEditar } from "../../components/motor/useEdicao";
import type { Pagamento } from "../../lib/transportes/tipos";
import "../veiculos/veiculos.css";

/** A janela do pagamento: tudo se edita no lugar. */
export function JanelaDoPagamento({ pagamento, campos, onEditar, onExcluir, onFechar }: { pagamento: Pagamento | null; campos: readonly CampoDaTela<Pagamento>[]; onEditar: OnEditar<Pagamento>; onExcluir: (p: Pagamento) => Promise<void>; onFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const ed = useEdicao<Pagamento>((p) => p.id, onEditar);
  const [excluindo, setExcluindo] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const id = pagamento?.id;
  useEffect(() => { const d = ref.current; if (!d) return; if (id && !d.open) d.showModal(); if (!id && d.open) d.close(); }, [id]);
  const editaveis = campos.filter((c) => c.edicao).map((c) => c.id);
  return (
    <dialog ref={ref} className="mt-janela" aria-label={`Pagamento ${pagamento?.numero ?? ""}`} onClose={(e) => { if (e.target === e.currentTarget) onFechar(); }} onClick={(e) => { if (e.target === ref.current) onFechar(); }}>
      {pagamento && (
        <div className="mt-janela__corpo" data-testid="janela-pagamento">
          <header className="mt-janela__topo">
            <div><h2 className="t-h2" data-testid="titulo-janela">{pagamento.numero}</h2><div className="mt-janela__sub">{formatar(campos.find((c) => c.id === "status")!, pagamento)}</div></div>
            <button type="button" className="mt-janela__fechar" aria-label="Fechar" onClick={onFechar}><X size={22} /></button>
          </header>
          <div className="mt-janela__conteudo">
            {(ed.erro || falha) && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{ed.erro ?? falha}</span><button type="button" aria-label="Fechar aviso" onClick={() => { ed.setErro(null); setFalha(null); }}><X size={16} /></button></p>}
            <dl className="mt-ficha" data-testid="ficha-dados">
              {campos.map((c) => <div key={c.id} className="mt-ficha__linha"><dt>{c.titulo}</dt><dd><CampoEditavel linha={pagamento} campo={c} ed={ed} navegaveis={editaveis} /></dd></div>)}
            </dl>
            <div><Button variant="danger" icon={<Trash size={18} />} onClick={() => setExcluindo(true)} data-testid="excluir-pagamento">Excluir pagamento</Button></div>
          </div>
          <Sheet open={excluindo} onClose={() => setExcluindo(false)} title="Excluir pagamento">
            <div className="ds-stack">
              <p className="t-body">Excluir <b>{pagamento.numero}</b>? Os transportes ligados a ele continuam, só ficam sem pagamento. Não dá para desfazer.</p>
              <Button variant="danger" size="lg" block onClick={() => void onExcluir(pagamento).then(() => setExcluindo(false)).catch((e: Error) => { setFalha(e.message); setExcluindo(false); })} data-testid="confirmar-exclusao">Excluir pagamento</Button>
            </div>
          </Sheet>
        </div>
      )}
    </dialog>
  );
}
