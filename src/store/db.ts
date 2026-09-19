import Dexie, { type EntityTable } from "dexie";
import type { LedgerEvent } from "@/domain/ledger";

/** An event as held locally: the wire shape plus a sync flag (Dexie indexes numbers, not booleans). */
export type StoredEvent = LedgerEvent & { synced: 0 | 1 };

interface KV {
  key: string;
  value: unknown;
}

export class QadaDatabase extends Dexie {
  events!: EntityTable<StoredEvent, "id">;
  kv!: EntityTable<KV, "key">;

  constructor(name = "qadaos") {
    super(name);
    this.version(1).stores({
      events: "id, serverSeq, synced, occurredAt",
      kv: "key",
    });
  }

  async getKV<T>(key: string): Promise<T | undefined> {
    const row = await this.kv.get(key);
    return row?.value as T | undefined;
  }

  async setKV(key: string, value: unknown): Promise<void> {
    await this.kv.put({ key, value });
  }

  /** Stable per-install id stamped on every event this device creates. */
  async deviceId(): Promise<string> {
    const existing = await this.getKV<string>("deviceId");
    if (existing) return existing;
    const id = crypto.randomUUID();
    await this.setKV("deviceId", id);
    return id;
  }
}

export function createDatabase(name?: string): QadaDatabase {
  return new QadaDatabase(name);
}

let singleton: QadaDatabase | undefined;

/** The app's database. Client-only; never import from server code. */
export function getDb(): QadaDatabase {
  if (!singleton) singleton = createDatabase();
  return singleton;
}
