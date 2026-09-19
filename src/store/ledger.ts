import type { LedgerEvent } from "@/domain/ledger";
import type { QadaDatabase, StoredEvent } from "./db";

type EventInput = Omit<LedgerEvent, "id" | "occurredAt" | "tz" | "deviceId" | "serverSeq"> & {
  occurredAt?: string;
  tz?: string;
};

function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Write a new event locally. It is unsynced until the syncer pushes it. */
export async function appendEvent(db: QadaDatabase, input: EventInput): Promise<LedgerEvent> {
  const event = {
    id: crypto.randomUUID(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    tz: input.tz ?? deviceTz(),
    deviceId: await db.deviceId(),
    type: input.type,
    payload: input.payload,
  } as LedgerEvent;
  await db.events.add({ ...event, synced: 0 } as StoredEvent);
  return event;
}

/** Undo: a revocation event pointing at the original. The original row is never touched. */
export async function revokeEvent(db: QadaDatabase, targetId: string): Promise<LedgerEvent> {
  return appendEvent(db, { type: "event.revoked", payload: { v: 1, target: targetId } });
}

export function stripStored(row: StoredEvent): LedgerEvent {
  const { synced, ...event } = row;
  void synced;
  return event as LedgerEvent;
}

/** Every event we hold, by occurredAt. The reducer applies the full canonical sort itself. */
export async function loadEvents(db: QadaDatabase): Promise<LedgerEvent[]> {
  const rows = await db.events.orderBy("occurredAt").toArray();
  return rows.map(stripStored);
}
