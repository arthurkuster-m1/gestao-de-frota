import { useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CaretRight, Note, Plus, Star, Trash } from "@phosphor-icons/react";
import { cx } from "../../ds";
import type { NoDaArvore } from "../../lib/anotacoes/paginas";

const CHAVE = "frota:anotacoes-abertas";
const lerAbertas = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(CHAVE) ?? "[]") as string[]); } catch { return new Set(); } };

type Acoes = { selecionadoId: string | null; favoritas: ReadonlySet<string>; onSelecionar: (id: string) => void; onCriarFilha: (id: string) => void; onFavorita: (id: string) => void; onLixeira: (id: string) => void; onReordenar: (irmas: NoDaArvore[], idMovido: string, destino: number) => void };

function Linha({ no, nivel, abertas, alternar, a }: { no: NoDaArvore; nivel: number; abertas: Set<string>; alternar: (id: string) => void; a: Acoes }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: no.nota.id });
  const aberta = abertas.has(no.nota.id), temFilhas = no.filhas.length > 0, ativa = a.selecionadoId === no.nota.id;
  return (
    <li>
      <div ref={setNodeRef} {...attributes} {...listeners} tabIndex={undefined} role={undefined} aria-roledescription={undefined} style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, paddingLeft: 6 + nivel * 16 }}
        className={cx("an-no", ativa && "is-ativa")} data-testid="no-da-arvore">
        <button type="button" className="an-no__seta" aria-label={aberta ? "Recolher" : "Expandir"} style={{ visibility: temFilhas ? "visible" : "hidden" }} onPointerDown={(e) => e.stopPropagation()} onClick={() => alternar(no.nota.id)}><CaretRight size={12} weight="bold" style={{ transform: aberta ? "rotate(90deg)" : undefined }} /></button>
        <button type="button" className="an-no__nome" onClick={() => a.onSelecionar(no.nota.id)} title={no.nota.title || "Sem título"}>
          <span className="an-no__icone" aria-hidden>{no.nota.icon || <Note size={15} />}</span><span className="an-no__titulo">{no.nota.title || "Sem título"}</span>
        </button>
        <span className="an-no__acoes" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="an-mini" aria-label={a.favoritas.has(no.nota.id) ? "Tirar dos favoritos" : "Favoritar"} title="Favorito" onClick={() => a.onFavorita(no.nota.id)}><Star size={14} weight={a.favoritas.has(no.nota.id) ? "fill" : "regular"} /></button>
          <button type="button" className="an-mini" aria-label="Nova subpágina" title="Nova subpágina" onClick={() => { a.onCriarFilha(no.nota.id); if (!aberta) alternar(no.nota.id); }} data-testid="nova-subpagina"><Plus size={14} /></button>
          <button type="button" className="an-mini" aria-label="Mandar para a lixeira" title="Mandar para a lixeira" onClick={() => a.onLixeira(no.nota.id)} data-testid="para-a-lixeira"><Trash size={14} /></button>
        </span>
      </div>
      {temFilhas && aberta && <Grupo nos={no.filhas} nivel={nivel + 1} abertas={abertas} alternar={alternar} a={a} />}
    </li>
  );
}

/** Um grupo de irmãs: arrastar uma linha só reordena entre as irmãs (como a ordem do Notion). */
function Grupo({ nos, nivel, abertas, alternar, a }: { nos: NoDaArvore[]; nivel: number; abertas: Set<string>; alternar: (id: string) => void; a: Acoes }) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const soltou = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const destino = nos.findIndex((n) => n.nota.id === e.over!.id);
    if (destino >= 0) a.onReordenar(nos, String(e.active.id), destino);
  };
  return (
    <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltou}>
      <SortableContext items={nos.map((n) => n.nota.id)} strategy={verticalListSortingStrategy}>
        <ul className="an-grupo" role="group">{nos.map((n) => <Linha key={n.nota.id} no={n} nivel={nivel} abertas={abertas} alternar={alternar} a={a} />)}</ul>
      </SortableContext>
    </DndContext>
  );
}

/** A árvore de páginas na lateral: expandir/recolher (guardado neste aparelho), criar subpágina, favoritar, lixeira e reordenar arrastando. */
export function ArvoreDeNotas({ arvore, ...a }: { arvore: NoDaArvore[] } & Acoes) {
  const [abertas, setAbertas] = useState<Set<string>>(lerAbertas);
  const alternar = (id: string) => setAbertas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); try { localStorage.setItem(CHAVE, JSON.stringify([...n])); } catch { /* sem armazenamento */ } return n; });
  if (arvore.length === 0) return <p className="t-body-sm t-muted" style={{ padding: "8px 10px" }}>Nenhuma página ainda. Crie a primeira em “Nova página”.</p>;
  return <Grupo nos={arvore} nivel={0} abertas={abertas} alternar={alternar} a={a} />;
}
