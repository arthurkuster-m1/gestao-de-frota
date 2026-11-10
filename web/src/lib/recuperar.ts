/**
 * "Ctrl + Shift + R" por dentro: remove o service worker e apaga os caches do app, e recarrega. Serve para sair de uma tela branca
 * causada por uma versão antiga guardada no aparelho.
 */
export async function recuperarApp(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map((r) => r.unregister())); }
    if ("caches" in window) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); }
  } catch { /* segue para o recarregar */ }
  window.location.reload();
}
