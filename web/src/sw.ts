/// <reference lib="webworker" />
/** Service worker: guarda o app em cache para abrir mesmo sem internet. A versão nova assume na hora e a tela avisa. */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));
self.addEventListener("install", () => void self.skipWaiting());
self.addEventListener("message", (e) => { if ((e.data as { type?: string } | null)?.type === "SKIP_WAITING") void self.skipWaiting(); });
// Notificações: clicar nelas (ou no botão) abre o endereço que veio junto; "push" é a entrada para o envio pelo servidor (etapa seguinte).
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data as { url?: string } | null)?.url ?? "/";
  e.waitUntil(self.clients.openWindow(url));
});
self.addEventListener("push", (e) => {
  const d = (e.data?.json() ?? {}) as { titulo?: string; corpo?: string; botao?: string; url?: string; tag?: string };
  e.waitUntil(self.registration.showNotification(d.titulo ?? "Frota", { body: d.corpo, icon: "/icon-192.png", badge: "/icon-192.png", tag: d.tag, requireInteraction: true, data: { url: d.url ?? "/" }, ...(d.botao ? { actions: [{ action: "abrir", title: d.botao }] } : {}) } as NotificationOptions));
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
