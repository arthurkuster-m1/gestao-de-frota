import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cx } from "../../ds";

/** Cabeçalho que se arrasta para mudar a coluna de lugar (clicar sem arrastar continua abrindo o menu da coluna). */
export function ThOrdenavel({ id, travada, estilo, className, ...resto }: { id: string; travada: boolean; estilo?: CSSProperties; className?: string } & React.ThHTMLAttributes<HTMLTableCellElement>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: travada });
  return <th ref={setNodeRef} {...attributes} role="columnheader" {...listeners} {...resto} className={cx(className, !travada && "mt-th--arrasta", isDragging && "is-arrastando")}
    style={{ ...estilo, transform: CSS.Translate.toString(transform), transition, ...(isDragging ? { zIndex: 8, opacity: 0.85 } : {}) }} />;
}
