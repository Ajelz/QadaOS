import type { LedgerEvent } from "@/domain/ledger";
import type { QadaDatabase, StoredEvent } from "./db";
import { stripStored } from "./ledger";

export interface PushResult {
  accepted: { id: string; serverSeq: number }[];
}

export interface PullResult {
  events: (LedgerEvent & { serverSeq: number })[];
  cursor: number;
  hasMore: boolean;
}

export interface SyncTransport {
  push(events: LedgerEvent[]): Promise<PushResult>;
  pull(since: number): Promise<PullResult>;
}

export interface SyncerOptions {
  batchSize?: number;
}

const CURSOR_KEY = "syncCursor";

/**
 * Outbox sync. Push everything unsynced in batches, then pull everything after our
 * cursor. Both directions are set unions on event id, so retries and overlaps are safe.
 */
export function createSyncer(db: QadaDatabase, transport: SyncTransport, options: SyncerOptions = {}) {
  const batchSize = options.batchSize ?? 500;

  async function pushAll(): Promise<number> {
    let pushed = 0;
    for (;;) {
      const batch = await db.events.where("synced").equals(0).limit(batchSize).toArray();
      if (batch.length === 0) return pushed;
      const result = await transport.push(batch.map(stripStored));
      await db.transaction("rw", db.events, async () => {
        for (const a of result.accepted) {
          await db.events.update(a.id, { synced: 1, serverSeq: a.serverSeq });
        }
      });
      pushed += result.accepted.length;
      // Anything the server did not echo back stays unsynced and is retried next run.
      if (result.accepted.length === 0) return pushed;
    }
  }

  async function pullAll(): Promise<number> {
    let pulled = 0;
    let since = (await db.getKV<number>(CURSOR_KEY)) ?? 0;
    for (;;) {
      const page = await transport.pull(since);
      if (page.events.length > 0) {
        const rows: StoredEvent[] = page.events.map((e) => ({ ...e, synced: 1 }));
        await db.events.bulkPut(rows);
        pulled += rows.length;
      }
      since = page.cursor;
      await db.setKV(CURSOR_KEY, since);
      if (!page.hasMore) return pulled;
    }
  }

  return {
    async sync(): Promise<{ pushed: number; pulled: number }> {
      const pushed = await pushAll();
      const pulled = await pullAll();
      return { pushed, pulled };
    },
    unsyncedCount(): Promise<number> {
      return db.events.where("synced").equals(0).count();
    },
    async cursor(): Promise<number> {
      return (await db.getKV<number>(CURSOR_KEY)) ?? 0;
    },
  };
}

/** The real transport against this app's API. */
export const httpTransport: SyncTransport = {
  async push(events) {
    const res = await fetch("/api/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events }),
      credentials: "same-origin",
    });
    if (!res.ok) throw new SyncHttpError(res.status, await safeMessage(res));
    return (await res.json()) as PushResult;
  },
  async pull(since) {
    const res = await fetch(`/api/sync/pull?since=${since}`, { credentials: "same-origin" });
    if (!res.ok) throw new SyncHttpError(res.status, await safeMessage(res));
    return (await res.json()) as PullResult;
  },
};

export class SyncHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function safeMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    return j.error?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}
