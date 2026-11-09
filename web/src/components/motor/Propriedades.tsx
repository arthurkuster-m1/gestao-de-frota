import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical, Eye, EyeSlash } from "@phosphor-icons/react";
import { Select } from "../../ds";
import { alternarVisibilidade, resolverColunas, type PreferenciasDaTabela } from "../../lib/motor/layout";
import type { CampoDaTela } from "./tipos";

function Item({ id, titulo, visivel, travada, onAlternar }: { id: string; titulo: string; visivel: boolean; travada: boolean; onAlternar: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled: travada });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="mt-prop" data-testid="propriedade">
      <button type="button" className="mt-prop__alca" aria-label={`Arrastar ${titulo}`} disabled={travada} {...attributes} {...listeners}><DotsSixVertical size={18} /></button>
      <span className="mt-prop__nome">{titulo}</span>
      <button type="button" className="mt-prop__olho" aria-label={`${visivel ? "Esconder" : "Mostrar"} ${titulo}`} aria-pressed={visivel} disabled={travada} onClick={onAlternar}>{visivel ? <Eye size={20} /> : <EyeSlash size={20} />}</button>
    </li>
  );
}

/** Escolher, ordenar (arrastando) e congelar as propriedades da visualização. Vive dentro do painel de configuração da visualização. */
export function Propriedades<T>({ campos, prefs, onChange, linhaDoTempo }: { campos: readonly CampoDaTela<T>[]; prefs: PreferenciasDaTabela; onChange: (p: PreferenciasDaTabela) => void; /** A visualização aberta é a Linha do tempo: mostra a escolha da parte fixa. */ linhaDoTempo?: boolean }) {
  const cols = resolverColunas(campos, prefs);
  const movel = cols.filter((c) => !c.fixa);
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const tituloDe = (id: string) => campos.find((c) => c.id === id)?.titulo ?? id;
  const aoSoltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = movel.map((c) => c.id);
    onChange({ ...prefs, ordem: arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))) });
  };
  const visiveis = cols.filter((c) => c.visivel).length;
  const congelar = prefs.congelar ?? 1;
  // Linha do tempo: o que fica na parte fixa à esquerda. Sem escolha, são as primeiras colunas congeladas.
  const fixasTl = prefs.esquerdaLinhaDoTempo ?? cols.filter((c) => c.visivel).slice(0, Math.max(1, congelar)).map((c) => c.id);
  const alternarFixa = (id: string) => {
    const novo = fixasTl.includes(id) ? fixasTl.filter((x) => x !== id) : [...fixasTl, id];
    if (novo.length === 0 || novo.length > 6) return;
    onChange({ ...prefs, esquerdaLinhaDoTempo: cols.filter((c) => novo.includes(c.id)).map((c) => c.id) });
  };
  return (
    <div className="mt-props-bloco" data-testid="propriedades-da-visao">
      <div className="ds-row" style={{ justifyContent: "space-between" }}><span className="t-body" style={{ fontWeight: 700 }}>Propriedades</span><span className="t-body-sm t-muted">{visiveis} visíveis</span></div>
      <p className="t-body-sm t-muted">Escolha o que aparece, arraste para mudar a ordem e congele colunas à esquerda.</p>
        {cols.filter((c) => c.fixa).map((c) => <ul key={c.id} className="mt-props"><Item id={c.id} titulo={tituloDe(c.id)} visivel travada onAlternar={() => undefined} /></ul>)}
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
          <SortableContext items={movel.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="mt-props">
              {movel.map((c) => <Item key={c.id} id={c.id} titulo={tituloDe(c.id)} visivel={c.visivel} travada={!!c.semOcultar && false} onAlternar={() => onChange(alternarVisibilidade(prefs, cols, c.id))} />)}
            </ul>
          </SortableContext>
        </DndContext>
        {linhaDoTempo && (
          <div className="mt-fixas-tl" data-testid="fixas-da-linha-do-tempo">
            <span className="t-body" style={{ fontWeight: 600 }}>Parte fixa da linha do tempo</span>
            <p className="t-body-sm t-muted">Escolha as propriedades que ficam à esquerda, ao lado das barras (até 6).</p>
            <div className="mt-rap" style={{ flexWrap: "wrap", overflow: "visible" }} role="group" aria-label="Propriedades da parte fixa">
              {cols.map((c) => <button key={c.id} type="button" className={`mt-rap__chip${fixasTl.includes(c.id) ? " is-on" : ""}`} aria-pressed={fixasTl.includes(c.id)} onClick={() => alternarFixa(c.id)}>{tituloDe(c.id)}</button>)}
            </div>
          </div>
        )}
        <div className="mt-congelar"><span className="t-body" style={{ fontWeight: 600 }}>Congelar colunas</span>
          <Select aria-label="Congelar colunas" value={String(congelar)} onChange={(e) => onChange({ ...prefs, congelar: Number(e.target.value) })}>
            <option value="0">Nenhuma</option><option value="1">Primeira coluna</option>
            {[2, 3, 4].map((n) => <option key={n} value={n}>Primeiras {n} colunas</option>)}
          </Select>
        </div>
    </div>
  );
}
