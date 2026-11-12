import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MagnifyingGlass, Plus, Star, Trash } from "@phosphor-icons/react";
import { Button, Input, Page } from "../../ds";
import { lacunaAcabou, posicaoEntre, renumerar } from "../../lib/motor/ordem";
import { trechoDaBusca } from "../../lib/anotacoes/busca";
import { montarArvore, type NoDaArvore, type ResumoDaNota } from "../../lib/anotacoes/paginas";
import { ArvoreDeNotas } from "./ArvoreDeNotas";
import { LixeiraDeNotas } from "./LixeiraDeNotas";
import { PaginaDeNota } from "./PaginaDeNota";
import { useArvoreDeNotas } from "./useArvoreDeNotas";
import { useBuscaDeNotas } from "./useBuscaDeNotas";
import { useEstadoDasNotas } from "./useEstadoDasNotas";
import { useNota } from "./useNota";
import "./anotacoes.css";

/** Anotações: um bloco de notas em páginas e subpáginas, como o Notion. A página aberta fica no endereço (?p=). */
export function Anotacoes() {
  const [busca, setBusca] = useSearchParams();
  const idAberto = busca.get("p");
  const arvore = useArvoreDeNotas();
  const estado = useEstadoDasNotas();
  const [termo, setTermo] = useState("");
  const [lixeira, setLixeira] = useState(false);
  const achadas = useBuscaDeNotas(termo);

  const vivas = useMemo(() => arvore.notas.filter((n) => !n.deleted_at), [arvore.notas]);
  const nos = useMemo(() => montarArvore(vivas), [vivas]);
  const porId = useMemo(() => new Map(vivas.map((n) => [n.id, n])), [vivas]);
  const aberta = idAberto ? porId.get(idAberto) ?? null : null;
  const pagina = useNota(aberta ? aberta.id : null);
  const [removida, setRemovida] = useState<{ id: string; titulo: string } | null>(null);
  const [versao, setVersao] = useState(0);   // muda para o editor reabrir (ex.: ao desfazer a remoção de um cartão)

  const abrir = (id: string | null) => { const p = new URLSearchParams(busca); if (id) p.set("p", id); else p.delete("p"); setBusca(p, { replace: false }); };
  useEffect(() => { if (aberta) estado.abriu(aberta.id); }, [aberta?.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  // a página aberta foi apagada (ou não existe mais): volta para a tela vazia
  useEffect(() => { if (idAberto && arvore.carregado && !porId.has(idAberto)) abrir(null); }, [idAberto, arvore.carregado, porId]);   // eslint-disable-line react-hooks/exhaustive-deps

  const criar = async (pai: string | null) => { const n = await arvore.criar(pai); if (n) abrir(n.id); };
  /** Soltou a linha em outro lugar entre as irmãs: a posição é o ponto médio das vizinhas (renumera se a lacuna acabar). */
  const reordenar = (irmas: NoDaArvore[], idMovido: string, destino: number) => {
    const lista = irmas.map((n) => n.nota).filter((n) => n.id !== idMovido);
    const movida = irmas.find((n) => n.nota.id === idMovido)!.nota;
    const ant = lista[destino - 1], prox = lista[destino];
    if (lacunaAcabou(ant?.position, prox?.position)) {
      const ordem = [...lista.slice(0, destino), movida, ...lista.slice(destino)];
      const novas = renumerar(ordem.map((n) => n.position));
      ordem.forEach((n, i) => { if (n.position !== novas[i]) void arvore.mover(n.id, movida.parent_id, novas[i]!); });
      return;
    }
    void arvore.mover(idMovido, movida.parent_id, posicaoEntre(ant?.position, prox?.position));
  };
  const titulo = (id: string) => porId.get(id);
  const secao = (rotulo: string, ids: string[]) => ids.length > 0 && (
    <div className="an-secao"><p className="an-secao__titulo">{rotulo}</p>
      {ids.map((id) => { const n = titulo(id); return n && <button key={id} type="button" className={`an-atalho${aberta?.id === id ? " is-ativa" : ""}`} onClick={() => abrir(id)}><span aria-hidden>{n.icon ?? "📝"}</span><span className="an-no__titulo">{n.title || "Sem título"}</span></button>; })}
    </div>
  );

  return (
    <Page wide>
      <div className="an-tela" data-testid="tela-anotacoes">
        <aside className="an-lateral" aria-label="Páginas">
          <Button icon={<Plus size={18} />} block onClick={() => void criar(null)} data-testid="nova-pagina">Nova página</Button>
          <label className="an-busca"><MagnifyingGlass size={16} aria-hidden /><Input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar nas anotações…" aria-label="Buscar nas anotações" /></label>
          {termo.trim().length >= 2 ? (
            <div className="an-secao" data-testid="resultados-da-busca">
              <p className="an-secao__titulo">{achadas.buscando ? "Buscando…" : `${achadas.resultados.length} resultado${achadas.resultados.length === 1 ? "" : "s"}`}</p>
              {achadas.resultados.map((r) => (
                <button key={r.id} type="button" className="an-resultado" onClick={() => { abrir(r.id); setTermo(""); }}>
                  <span><span aria-hidden>{r.icon ?? "📝"}</span> <b>{r.title || "Sem título"}</b></span>
                  <span className="t-body-sm t-muted">{trechoDaBusca(r.search_text, termo.trim().toLowerCase())}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {secao("Favoritas", [...estado.favoritas].filter((id) => porId.has(id)))}
              {secao("Recentes", estado.recentes.filter((id) => porId.has(id) && !estado.favoritas.has(id)).slice(0, 5))}
              <div className="an-secao">
                <p className="an-secao__titulo">Páginas</p>
                {arvore.erro ? <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{arvore.erro}</p> : (
                  <ArvoreDeNotas arvore={nos} selecionadoId={aberta?.id ?? null} favoritas={estado.favoritas} onSelecionar={abrir} onCriarFilha={(id) => void criar(id)} onFavorita={(id) => void estado.alternarFavorita(id)} onLixeira={(id) => void arvore.paraALixeira(id)} onReordenar={reordenar} />
                )}
              </div>
              <button type="button" className="an-atalho" onClick={() => setLixeira(true)} data-testid="abrir-lixeira"><Trash size={16} aria-hidden /><span className="an-no__titulo">Lixeira{arvore.notas.some((n) => n.deleted_at) ? ` (${arvore.notas.filter((n) => n.deleted_at).length})` : ""}</span></button>
            </>
          )}
        </aside>
        <main className="an-principal">
          {aberta ? (
            <>
              {removida && (
                <div className="an-aviso" role="status">Subpágina “{removida.titulo || "Sem título"}” foi para a lixeira.
                  <button type="button" onClick={() => { void arvore.restaurar(removida.id).then(() => setVersao((v) => v + 1)); setRemovida(null); }}>Desfazer</button>
                </div>
              )}
              <PaginaDeNota key={`${aberta.id}-${versao}`} nota={aberta} todas={vivas} estado={pagina} onSelecionar={abrir}
                onTitulo={(t) => void arvore.mudar(aberta.id, { title: t })} onIcone={(i) => void arvore.mudar(aberta.id, { icon: i })}
                onCriarSubpagina={async () => (await arvore.criar(aberta.id))?.id ?? null}
                onRemoverSubpagina={(id) => { const n = porId.get(id); setRemovida({ id, titulo: n?.title ?? "" }); void arvore.paraALixeira(id); }}
                onReordenarSubpaginas={(ids) => ids.forEach((id, i) => { if (porId.get(id)?.position !== i + 1) void arvore.mover(id, aberta.id, i + 1); })} />
            </>
          ) : (
            <div className="an-vazio"><Star size={28} aria-hidden /><h1 className="t-h2">Anotações</h1><p className="t-body t-muted">{arvore.carregado && vivas.length === 0 ? "Comece criando a sua primeira página." : "Escolha uma página na lateral ou crie uma nova."}</p></div>
          )}
        </main>
      </div>
      <LixeiraDeNotas aberta={lixeira} onFechar={() => setLixeira(false)} notas={arvore.notas} onRestaurar={(id) => void arvore.restaurar(id)} onApagarDeVez={(id) => void arvore.apagarParaSempre(id)} />
    </Page>
  );
}

function achar(nos: NoDaArvore[], id: string): NoDaArvore | undefined {
  for (const n of nos) { if (n.nota.id === id) return n; const f = achar(n.filhas, id); if (f) return f; }
  return undefined;
}
export type { ResumoDaNota };
