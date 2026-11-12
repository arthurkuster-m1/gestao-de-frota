import { lazy, Suspense } from "react";
import { Spinner } from "../../ds";
import type { PropsDoEditorDeNotas } from "./EditorDeNotas";

// O editor é pesado: só baixa quando alguém abre uma página.
const Editor = lazy(() => import("./EditorDeNotas"));

export function EditorCarregavel(props: PropsDoEditorDeNotas) {
  return <Suspense fallback={<div className="an-editor-carregando"><Spinner /></div>}><Editor {...props} /></Suspense>;
}
