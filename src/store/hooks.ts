"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useMemo } from "react";
import { emptyState, reduce, type LedgerEvent, type LedgerState } from "@/domain/ledger";
import type { SettingsDoc } from "@/domain/schemas";
import { getDb } from "./db";
import { appendEvent, revokeEvent, stripStored } from "./ledger";
import { defaultSettings, getLocalSettings, patchLocalSettings } from "./settings";
import { syncManager } from "./syncManager";

/** Live ledger state: re-reduces whenever the local event table changes. */
export function useLedger(): { state: LedgerState; ready: boolean; events: LedgerEvent[] } {
  const rows = useLiveQuery(() => getDb().events.toArray(), []);
  const events = useMemo(() => rows?.map(stripStored) ?? [], [rows]);
  const state = useMemo(() => (rows ? reduce(events) : emptyState()), [rows, events]);
  return { state, ready: rows !== undefined, events };
}

type EventInput = Parameters<typeof appendEvent>[1];

/** Write helpers. Every write lands locally first, then nudges the syncer. */
export function useLedgerActions() {
  const append = useCallback(async (input: EventInput) => {
    const e = await appendEvent(getDb(), input);
    syncManager.requestSync();
    return e;
  }, []);
  const revoke = useCallback(async (targetId: string) => {
    const e = await revokeEvent(getDb(), targetId);
    syncManager.requestSync();
    return e;
  }, []);
  return { append, revoke };
}

export function useSettings(): { settings: SettingsDoc; ready: boolean; updatedAt?: string } {
  const stored = useLiveQuery(() => getLocalSettings(getDb()), []);
  return { settings: stored?.doc ?? defaultSettings(), ready: stored !== undefined, updatedAt: stored?.updatedAt };
}

export function useSettingsActions() {
  const patch = useCallback(async (fn: (doc: SettingsDoc) => SettingsDoc) => {
    const next = await patchLocalSettings(getDb(), fn);
    syncManager.requestSync(300);
    return next;
  }, []);
  return { patch };
}
