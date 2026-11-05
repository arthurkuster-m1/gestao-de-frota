import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarBlank, CalendarCheck, Warning, Wrench, X } from "@phosphor-icons/react";
import { Skeleton, Textarea, cx, useToast } from "../../ds";
import { CampoEditavel } from "../../components/motor/CampoEditavel";
import type { CampoDaTela } from "../../components/motor/tipos";
import { useEdicao, type OnEditar } from "../../components/motor/useEdicao";
import { formatar } from "../../components/motor/formatar";
import { listarAtividades, type Atividade } from "../../lib/veiculos/dados";
import { quando, textoAtividade } from "../../lib/veiculos/atividade";
import type { Veiculo } from "../../lib/veiculos/tipos";
import "./veiculos.css";

type Aba = "dados" | "atividade" | "comentarios" | "agenda" | "eventos" | "manutencoes" | "multas";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "dados", rotulo: "Dados" }, { id: "atividade", rotulo: "Atividade" }, { id: "comentarios", rotulo: "Comentários" },
  { id: "agenda", rotulo: "Agenda" }, { id: "eventos", rotulo: "Eventos" }, { id: "manutencoes", rotulo: "Manutenções" }, { id: "multas", rotulo: "Multas" },
];

function EmBreve({ icone, titulo, children }: { icone: ReactNode; titulo: string; children: ReactNode }) {
  return <div className="mt-embreve" data-testid="aba-em-breve">{icone}<h3 className="t-h3">{titulo}</h3><p className="t-body t-muted">{children}</p></div>;
}

/** A janela do veículo: tudo sobre um carro, em abas. Dados e Comentários se editam no lugar, como na tabela e nos cards. */
export function JanelaDoVeiculo({ veiculo, campos, onEditar, onFechar }: { veiculo: Veiculo | null; campos: readonly CampoDaTela<Veiculo>[]; onEditar: OnEditar<Veiculo>; onFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [aba, setAba] = useState<Aba>("dados");
  const [hist, setHist] = useState<Atividade[] | null>(null);
  const ed = useEdicao<Veiculo>((v) => v.id, onEditar);
  const toast = useToast();
  const id = veiculo?.id;
  const [comentario, setComentario] = useState("");
  const [erroComentario, setErroComentario] = useState<string | null>(null);

  useEffect(() => { const d = ref.current; if (!d) return; if (id && !d.open) d.showModal(); if (!id && d.open) d.close(); }, [id]);
  useEffect(() => { setAba("dados"); setHist(null); }, [id]);
  useEffect(() => { setComentario(veiculo?.comentarios ?? ""); setErroComentario(null); }, [id, veiculo?.comentarios]);
  useEffect(() => { if (aba === "atividade" && id) { setHist(null); listarAtividades(id).then(setHist, () => setHist([])); } }, [aba, id, veiculo?.status_ciclo]);

  const titulo = veiculo ? (veiculo.codigo ?? veiculo.modelo.toUpperCase()) : "";
  const editaveis = campos.filter((c) => c.edicao).map((c) => c.id);
  const lista = campos.filter((c) => c.id !== "codigo" && c.id !== "comentarios");
  const campoComentarios = campos.find((c) => c.id === "comentarios");

  async function salvarComentario() {
    if (!veiculo || !campoComentarios || comentario === (veiculo.comentarios ?? "")) return;
    setErroComentario(null);
    try { await onEditar(veiculo, campoComentarios, comentario.trim() === "" ? null : comentario); toast("Salvo"); } catch (e) { setErroComentario((e as Error).message); }
  }

  return (
    <dialog ref={ref} className="mt-janela" aria-label={`Veículo ${titulo}`} onClose={onFechar} onClick={(e) => { if (e.target === ref.current) onFechar(); }}>
      {veiculo && (
        <div className="mt-janela__corpo" data-testid="janela-veiculo">
          <header className="mt-janela__topo">
            <div><h2 className="t-h2" data-testid="titulo-janela">{titulo}</h2><div className="mt-janela__sub">{formatar(campos.find((c) => c.id === "ciclo")!, veiculo)}</div></div>
            <button type="button" className="mt-janela__fechar" aria-label="Fechar" onClick={onFechar}><X size={22} /></button>
          </header>
          <div className="mt-abas" role="tablist" aria-label="Seções do veículo">
            {ABAS.map((a) => <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={cx("mt-aba", aba === a.id && "is-on")} onClick={() => setAba(a.id)} data-testid="aba-janela">{a.rotulo}</button>)}
          </div>
          <div className="mt-janela__conteudo">
            {ed.erro && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{ed.erro}</span><button type="button" aria-label="Fechar aviso" onClick={() => ed.setErro(null)}><X size={16} /></button></p>}
            {aba === "dados" && (
              <dl className="mt-ficha" data-testid="ficha-dados">
                <div className="mt-ficha__linha"><dt>Código</dt><dd><span className="mt-valor" style={{ fontWeight: 700 }}>{titulo}</span></dd></div>
                {lista.map((c) => <div key={c.id} className="mt-ficha__linha"><dt>{c.titulo}</dt><dd><CampoEditavel linha={veiculo} campo={c} ed={ed} navegaveis={editaveis} /></dd></div>)}
              </dl>
            )}
            {aba === "atividade" && (hist === null ? <Skeleton h={20} /> : hist.length === 0 ? <p className="t-body t-muted">Sem atividade registrada.</p>
              : <ul className="vei-hist" data-testid="historico">{hist.map((a) => <li key={a.id}><span className="t-body">{textoAtividade(a.descricao)}</span><span className="t-body-sm t-muted">{quando(a.ocorreu_em)}</span></li>)}</ul>)}
            {aba === "comentarios" && (
              <div className="ds-stack">
                <p className="t-body-sm t-muted">Anotações livres sobre este carro. Salva ao sair do campo.</p>
                <Textarea rows={10} value={comentario} aria-label="Comentários do veículo" data-testid="campo-comentarios" onChange={(e) => setComentario(e.target.value)} onBlur={() => void salvarComentario()} />
                {erroComentario && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{erroComentario}</p>}
              </div>
            )}
            {aba === "agenda" && <EmBreve icone={<CalendarBlank size={32} />} titulo="Agenda do veículo">Mostra, em calendário e em texto (“EM USO – EVENTO X 04/11 ATÉ 05/11 + RESERVADO – EVENTO Y 07/11 ATÉ 12/11”), tudo o que este carro vai fazer. Entra junto com a tela de Eventos, porque a agenda é calculada das reservas.</EmBreve>}
            {aba === "eventos" && <EmBreve icone={<CalendarCheck size={32} />} titulo="Eventos">Histórico e eventos futuros deste carro, com o status de cada reserva. Entra com a tela de Eventos.</EmBreve>}
            {aba === "manutencoes" && <EmBreve icone={<Wrench size={32} />} titulo="Manutenções">Todas as manutenções e sinistros que o carro já teve e as que estão em aberto. Entra com a tela de Manutenções.</EmBreve>}
            {aba === "multas" && <EmBreve icone={<Warning size={32} />} titulo="Multas">Multas do carro, com o evento e o cliente que estavam com ele na hora. Entra com a tela de Multas.</EmBreve>}
          </div>
        </div>
      )}
    </dialog>
  );
}
