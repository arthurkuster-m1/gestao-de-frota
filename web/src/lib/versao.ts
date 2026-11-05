/** Atualização do app: procura versão nova ao abrir/voltar, avisa quando o service worker novo assume e permite forçar a verificação. */
declare const __VERSAO__: string;
export const VERSAO = typeof __VERSAO__ === "string" ? __VERSAO__ : "dev";
export const EVENTO_ATUALIZADO = "app-atualizado";

export function iniciarAtualizacao() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const tinhaControle = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!tinhaControle) return; // primeira instalação: nada a recarregar
    if (document.visibilityState === "hidden") window.location.reload(); // ninguém está olhando: recarrega já
    else window.dispatchEvent(new Event(EVENTO_ATUALIZADO)); // alguém está usando: pergunta (pode estar no meio de um formulário)
  });
  const checar = () => { void navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => undefined); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checar(); });
  checar();
}

/** Botão "Verificar atualização": devolve true se achou versão nova (e a tela vai avisar). */
export async function verificarAgora(): Promise<"nova" | "atual" | "sem_sw"> {
  if (!("serviceWorker" in navigator)) return "sem_sw";
  const r = await navigator.serviceWorker.getRegistration();
  if (!r) return "sem_sw";
  await r.update();
  await new Promise((ok) => setTimeout(ok, 1500));
  return r.installing || r.waiting ? "nova" : "atual";
}
