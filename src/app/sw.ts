/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { NetworkOnly, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // The ledger is local-first: never let the service worker cache sync or auth traffic.
    { matcher: ({ url }) => url.pathname.startsWith("/api/"), handler: new NetworkOnly() },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: "/~offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

// A waiting worker activates when the page asks (the "new version" toast).
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

interface PushPayload {
  title: string;
  body: string;
  kind: string;
  prayerDay: string;
  url?: string;
}

self.addEventListener("push", (event) => {
  let data: PushPayload = { title: "QadaOS", body: "Open the app.", kind: "generic", prayerDay: "" };
  try {
    data = { ...data, ...(event.data?.json() as Partial<PushPayload>) };
  } catch {
    // Non-JSON payloads fall back to the default text.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: `${data.kind}:${data.prayerDay}`,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => "focus" in c);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

serwist.addEventListeners();
