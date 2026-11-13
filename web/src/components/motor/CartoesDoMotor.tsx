import { useMemo, useState, type ReactNode } from "react";
import { ArrowSquareOut, CaretDown, CaretRight, X } from "@phosphor-icons/react";
import { aplicarConsulta } from "../../lib/motor/consulta";
import { hojeLocal } from "../../lib/motor/datas";
import { resolverColunas, type PreferenciasDaTabela } from "../../lib/motor/layout";
import { CampoEditavel } from "./CampoEditavel";
import { formatar } from "./formatar";
import { useEdicao, type OnEditar } from "./useEdicao";
import type { CampoDaTela } from "./tipos";
import "./motor.css";

type Props<T> = {
  linhas: readonly T[]; campos: readonly CampoDaTela<T>[]; prefs: PreferenciasDaTabela; idDe: (l: T) => string; onAbrir?: (l: T) => void;
  vazio: ReactNode; rotuloDoTotal?: (n: number, linhas: readonly T[]) => string; onEditar?: OnEditar<T>;
};

/** A visão em Cards: a mesma consulta, as mesmas propriedades visíveis (na ordem escolhida) e a mesma edição no lugar da tabela. */
export function CartoesDoMotor<T>({ linhas, campos, prefs, idDe, onAbrir, vazio, rotuloDoTotal, onEditar }: Props<T>) {
  const ed = useEdicao<T>(idDe, onEditar);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const visiveis = useMemo(() => resolverColunas(campos, prefs).filter((c) => c.visivel), [campos, prefs]);
  const resultado = useMemo(() => aplicarConsulta(linhas, campos, prefs, { hoje: hojeLocal() }), [linhas, campos, prefs]);
  const porId = useMemo(() => new Map(campos.map((c) => [c.id, c])), [campos]);
  const titulo = porId.get(visiveis[0]?.id ?? "")!; // a coluna fixa (o código) é o título do card
  const corpo = visiveis.slice(1).map((c) => porId.get(c.id)!).filter(Boolean);
  const navegaveis = corpo.filter((c) => c.edicao).map((c) => c.id);

  const card = (l: T) => (
    <article key={idDe(l)} className="mt-card" data-testid="card-motor">
      <header className="mt-card__topo">
        {onAbrir ? <button type="button" className="mt-card__titulo" onClick={() => onAbrir(l)}>{formatar(titulo, l)}</button> : <span className="mt-card__titulo">{formatar(titulo, l)}</span>}
        {onAbrir && <button type="button" className="mt-abrir mt-abrir--fixo" aria-label="Abrir ficha" onClick={() => onAbrir(l)}><ArrowSquareOut size={18} /></button>}
      </header>
      <dl className="mt-card__campos">
        {corpo.map((c) => (
          <div key={c.id} className="mt-card__linha"><dt>{c.titulo}</dt><dd><CampoEditavel linha={l} campo={c} ed={ed} navegaveis={navegaveis} /></dd></div>
        ))}
        {corpo.length === 0 && <p className="t-body-sm t-muted">Ligue propriedades em “Propriedades” para elas aparecerem no card.</p>}
      </dl>
    </article>
  );
  const campoG = porId.get(prefs.agrupar ?? "");

  return (
    <div className="mt-tabela-wrap">
      {ed.erro && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{ed.erro}</span><button type="button" aria-label="Fechar aviso" onClick={() => ed.setErro(null)}><X size={16} /></button></p>}
      {resultado.linhas.length === 0 ? <div className="mt-sem">{linhas.length === 0 ? vazio : <p className="t-body t-muted">Nada bate com os filtros desta visualização.</p>}</div>
        : resultado.grupos ? resultado.grupos.map((g) => {
          const fechado = fechados.has(g.chave);
          return (
            <section key={g.chave} className="mt-cards-grupo" data-testid="grupo-motor">
              <button type="button" className="mt-grupo__btn" aria-expanded={!fechado} onClick={() => setFechados((s) => { const n = new Set(s); if (n.has(g.chave)) n.delete(g.chave); else n.add(g.chave); return n; })}>
                {fechado ? <CaretRight size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}<b>{g.rotulo || `Sem ${campoG?.titulo.toLowerCase() ?? "valor"}`}</b><span className="mt-grupo__n">{g.linhas.length}</span>
              </button>
              {!fechado && <div className="mt-cards">{g.linhas.map(card)}</div>}
            </section>
          );
        })
        : <div className="mt-cards" data-testid="cards-motor">{resultado.linhas.map(card)}</div>}
      <p className="t-body-sm t-muted mt-total" data-testid="total-motor">{rotuloDoTotal ? rotuloDoTotal(resultado.linhas.length, resultado.linhas) : `${resultado.linhas.length} registros`}{resultado.linhas.length !== linhas.length ? ` de ${linhas.length}` : ""}</p>
    </div>
  );
}
