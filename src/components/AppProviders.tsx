"use client";

import { useEffect, type ReactNode } from "react";
import { ToastProvider, useToast } from "./ui/Toast";

/** Registers the service worker and offers a reload when a new version is waiting. */
function ServiceWorkerBridge() {
  const toast = useToast();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        const offer = (sw: ServiceWorker) =>
          toast({
            message: "A new version is ready.",
            tone: "yellow",
            durationMs: 15000,
            action: { label: "Reload", onClick: () => sw.postMessage({ type: "SKIP_WAITING" }) },
          });
        if (reg.waiting) offer(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) offer(sw);
          });
        });
      })
      .catch(() => undefined);
  }, [toast]);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ServiceWorkerBridge />
      {children}
    </ToastProvider>
  );
}
