import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical } from "@phosphor-icons/react";
import { Button } from "../../ds";

type Item = { id: string; titulo: string };

function Linha({ id, titulo, ligada, onAlternar, travada }: { id: string; titulo: string; ligada: boolean; onAlternar: () => void; travada: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="mt-prop" data-testid="coluna-da-importacao">
      <button type="button" className="mt-prop__alca" aria-label={`Arrastar ${titulo}`} {...attributes} {...listeners}><DotsSixVertical size={18} /></button>
      <label className="mt-prop__nome" style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, cursor: travada ? "default" : "pointer" }}>
        <input type="checkbox" checked={ligada} disabled={travada} onChange={onAlternar} aria-label={`Mostrar ${titulo}`} />{titulo}
      </label>
    </li>
  );
}

/**
 * Escolhe quais colunas aparecem na tabela de importação (caixinha) e em que ordem (arrastando a alça ⋮⋮).
 * `ordem` tem TODAS as colunas na ordem escolhida; `ligadas` são as que aparecem. Pelo menos uma fica ligada.
 */
export function SeletorDeColunas({ ordem, titulos, ligadas, onChange, onPadrao }: {
  ordem: readonly string[]; titulos: readonly Item[]; ligadas: ReadonlySet<string>; onChange: (ordem: string[], ligadas: Set<string>) => void; onPadrao: () => void;
}) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const nome = (id: string) => titulos.find((t) => t.id === id)?.titulo ?? id;
  const aoSoltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const a = ordem.indexOf(String(e.active.id)), b = ordem.indexOf(String(e.over.id));
    if (a >= 0 && b >= 0) onChange(arrayMove([...ordem], a, b), new Set(ligadas));
  };
  const alternar = (id: string) => { const n = new Set(ligadas); if (n.has(id)) { if (n.size > 1) n.delete(id); } else n.add(id); onChange([...ordem], n); };
  return (
    <div className="mt-painel__corpo">
      <p className="t-body-sm t-muted">Marque as colunas que aparecem e arraste pela alça para mudar a ordem.</p>
      <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
        <SortableContext items={[...ordem]} strategy={verticalListSortingStrategy}>
          <ul className="mt-props" role="list" style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 340, overflow: "auto" }}>
            {ordem.map((id) => <Linha key={id} id={id} titulo={nome(id)} ligada={ligadas.has(id)} travada={ligadas.has(id) && ligadas.size === 1} onAlternar={() => alternar(id)} />)}
          </ul>
        </SortableContext>
      </DndContext>
      <Button size="sm" variant="ghost" onClick={onPadrao}>Voltar às colunas de sempre</Button>
    </div>
  );
}
