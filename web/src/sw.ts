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
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
