"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { syncManager, useSyncState } from "@/store/syncManager";

const base = "mx-4 mb-3 flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-btn)] border-[length:var(--bw)] border-ink px-3 py-2 text-center text-[13px] font-extrabold leading-tight text-balance min-[900px]:mx-0";
const depth = { boxShadow: "var(--shadow-sm)" };

/** A status bar under the top edge. Silent when everything is synced and online. */
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

  const changes = `${s.unsynced} ${s.unsynced === 1 ? "change" : "changes"}`;

  if (flash)
    return (
      <div role="status" className={`${base} bg-teal`} style={depth}>
        All changes synced
      </div>
    );

  if (s.status === "offline")
    return (
      <div role="status" className={`${base} bg-ink text-cream`} style={depth}>
        {s.unsynced > 0 ? `Offline. ${changes} saved here, will sync when you reconnect.` : "Offline. Everything still works and will sync later."}
      </div>
    );

  if (s.status === "error")
    return (
      <button type="button" onClick={() => void syncManager.syncNow()} className={`${base} pressable w-[calc(100%-2rem)] bg-ink text-cream min-[900px]:w-full`} style={depth}>
        Could not sync{s.unsynced > 0 ? ` ${changes}` : ""}. Tap to try again.
      </button>
    );

  if (s.status === "unauthenticated")
    return (
      <div role="status" className={`${base} bg-paper`} style={depth}>
        <span>
          You are signed out. {s.unsynced > 0 ? `${changes} saved on this device.` : "Your ledger is safe on this device."}{" "}
          <Link href="/sign-in" className="underline">
            Sign in to sync
          </Link>
        </span>
      </div>
    );

  if (s.unsynced > 0)
    return (
      <div role="status" className={`${base} bg-paper`} style={depth}>
        Syncing {changes}
      </div>
    );

  return null;
}
