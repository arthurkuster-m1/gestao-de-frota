import { lazy, Suspense } from "react";
import { Spinner } from "../../ds";
import type { PropsDoEditorDeNotas } from "./EditorDeNotas";

// O editor (Tiptap + ProseMirror) fica num pacote à parte: só é baixado quando alguém abre uma página
// de Anotações. Quem usa o resto do app nunca paga esse peso.
const Editor = lazy(() => import("./EditorDeNotas"));

export function EditorCarregavel(props: PropsDoEditorDeNotas) {
  return <Suspense fallback={<div className="an-editor-carregando"><Spinner /></div>}><Editor {...props} /></Suspense>;
}
