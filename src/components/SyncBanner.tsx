"use client";

import { useEffect, useState } from "react";
import { syncManager, useSyncState } from "@/store/syncManager";

/** Thin ink bar under the header. Silent when everything is synced and online. */
export function SyncBanner() {
  const s = useSyncState();
  const [flash, setFlash] = useState(false);

  // Flash "Synced" once when the outbox drains. Driven by the manager's subscription,
  // not by render state, so it never re-triggers on unrelated re-renders.
  useEffect(() => {
    let prev = syncManager.getSnapshot().unsynced;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = syncManager.subscribe(() => {
      const next = syncManager.getSnapshot();
      if (prev > 0 && next.unsynced === 0 && next.status === "idle") {
        setFlash(true);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => setFlash(false), 1800);
      }
      prev = next.unsynced;
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (flash) return <div className="mx-4 rounded-[8px] border-2 border-ink bg-teal px-3 py-1.5 text-center text-[12px] font-bold">Synced</div>;

  if (s.status === "offline")
    return (
      <div className="mx-4 rounded-[8px] border-2 border-ink bg-ink px-3 py-1.5 text-center text-[12px] font-bold text-cream">
        Offline{s.unsynced > 0 ? `, ${s.unsynced} ${s.unsynced === 1 ? "change" : "changes"} waiting` : ""}
      </div>
    );

  if (s.status === "error")
    return (
      <button type="button" onClick={() => void syncManager.syncNow()} className="mx-4 rounded-[8px] border-2 border-ink bg-coral px-3 py-1.5 text-center text-[12px] font-bold">
        Sync failed. Tap to retry.
      </button>
    );

  if (s.status === "unauthenticated")
    return <div className="mx-4 rounded-[8px] border-2 border-ink bg-yellow px-3 py-1.5 text-center text-[12px] font-bold">Signed out. Changes are saved on this device.</div>;

  if (s.unsynced > 0)
    return (
      <div className="mx-4 rounded-[8px] border-2 border-ink bg-paper px-3 py-1.5 text-center text-[12px] font-bold">
        Syncing {s.unsynced} {s.unsynced === 1 ? "change" : "changes"}
      </div>
    );

  return null;
}
