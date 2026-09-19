"use client";

import { useSyncExternalStore } from "react";
import { getDb } from "./db";
import { syncSettings } from "./settings";
import { createSyncer, httpTransport, SyncHttpError } from "./sync";

export type SyncStatus = "idle" | "syncing" | "offline" | "unauthenticated" | "error";

export interface SyncState {
  status: SyncStatus;
  unsynced: number;
  lastSyncedAt?: string;
  lastError?: string;
}

type Listener = () => void;

const state: SyncState = { status: "idle", unsynced: 0 };
const listeners = new Set<Listener>();
let started = false;
let inFlight: Promise<void> | undefined;
let debounce: ReturnType<typeof setTimeout> | undefined;

function emit(patch: Partial<SyncState>) {
  Object.assign(state, patch);
  snapshot = { ...state };
  for (const l of listeners) l();
}

let snapshot: SyncState = { ...state };

async function refreshUnsynced() {
  const n = await createSyncer(getDb(), httpTransport).unsyncedCount();
  if (n !== state.unsynced) emit({ unsynced: n });
}

async function run(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    emit({ status: "offline" });
    await refreshUnsynced();
    return;
  }
  emit({ status: "syncing" });
  try {
    const db = getDb();
    await createSyncer(db, httpTransport).sync();
    await syncSettings(db).catch(() => undefined);
    await refreshUnsynced();
    emit({ status: "idle", lastSyncedAt: new Date().toISOString(), lastError: undefined });
  } catch (e) {
    await refreshUnsynced();
    if (e instanceof SyncHttpError && e.status === 401) emit({ status: "unauthenticated" });
    else if (typeof navigator !== "undefined" && !navigator.onLine) emit({ status: "offline" });
    else emit({ status: "error", lastError: e instanceof Error ? e.message : String(e) });
  }
}

export const syncManager = {
  /** Sync now, coalescing concurrent requests. */
  syncNow(): Promise<void> {
    if (!inFlight) inFlight = run().finally(() => (inFlight = undefined));
    return inFlight;
  },
  /** Sync soon: called after every local write. */
  requestSync(delayMs = 800) {
    void refreshUnsynced();
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => void syncManager.syncNow(), delayMs);
  },
  start() {
    if (started || typeof window === "undefined") return;
    started = true;
    window.addEventListener("online", () => void syncManager.syncNow());
    window.addEventListener("offline", () => emit({ status: "offline" }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void syncManager.syncNow();
    });
    void syncManager.syncNow();
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot(): SyncState {
    return snapshot;
  },
};

const serverSnapshot: SyncState = { status: "idle", unsynced: 0 };

export function useSyncState(): SyncState {
  return useSyncExternalStore(syncManager.subscribe, syncManager.getSnapshot, () => serverSnapshot);
}
