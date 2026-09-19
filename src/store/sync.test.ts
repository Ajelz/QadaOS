import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "vitest";
import type { LedgerEvent } from "@/domain/ledger";
import { createDatabase, type QadaDatabase } from "./db";
import { appendEvent, loadEvents, revokeEvent } from "./ledger";
import { createSyncer, type SyncTransport } from "./sync";

/** An in-memory server with the same semantics as /api/sync: set union, monotonic seq. */
function fakeServer() {
  const store = new Map<string, LedgerEvent & { serverSeq: number }>();
  let seq = 0;
  const transport: SyncTransport = {
    async push(events) {
      for (const e of events) {
        if (!store.has(e.id)) store.set(e.id, { ...e, serverSeq: ++seq });
      }
      return { accepted: events.map((e) => ({ id: e.id, serverSeq: store.get(e.id)!.serverSeq })) };
    },
    async pull(since) {
      const events = [...store.values()].filter((e) => e.serverSeq > since).sort((a, b) => a.serverSeq - b.serverSeq);
      return { events, cursor: events.at(-1)?.serverSeq ?? since, hasMore: false };
    },
  };
  return { transport, store, seed: (e: LedgerEvent) => store.set(e.id, { ...e, serverSeq: ++seq }) };
}

let db: QadaDatabase;
let n = 0;

beforeEach(() => {
  db = createDatabase(`test-${Date.now()}-${n++}`);
});

describe("appendEvent", () => {
  test("stores the event unsynced with a generated id and the device id", async () => {
    const e = await appendEvent(db, { type: "qada.logged", payload: { v: 1, prayer: "fajr", count: 2, prayerDay: "2026-09-19" } });
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
    const rows = await db.events.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].synced).toBe(0);
    expect(rows[0].deviceId).toBe(await db.deviceId());
  });

  test("revokeEvent appends a revocation pointing at the target", async () => {
    const e = await appendEvent(db, { type: "qada.logged", payload: { v: 1, prayer: "fajr", count: 2, prayerDay: "2026-09-19" } });
    await revokeEvent(db, e.id);
    const events = await loadEvents(db);
    expect(events).toHaveLength(2);
    const revocation = events.find((x) => x.type === "event.revoked");
    expect(revocation?.type === "event.revoked" && revocation.payload.target).toBe(e.id);
  });
});

describe("createSyncer", () => {
  test("pushes unsynced events, records their server sequence and marks them synced", async () => {
    const server = fakeServer();
    await appendEvent(db, { type: "debt.set_initial", payload: { v: 1, prayer: "fajr", count: 4000 } });
    await appendEvent(db, { type: "qada.logged", payload: { v: 1, prayer: "fajr", count: 1, prayerDay: "2026-09-19" } });

    const syncer = createSyncer(db, server.transport);
    await syncer.sync();

    const rows = await db.events.toArray();
    expect(rows.every((r) => r.synced === 1)).toBe(true);
    expect(rows.map((r) => r.serverSeq).sort()).toEqual([1, 2]);
    expect(server.store.size).toBe(2);
    expect(await syncer.unsyncedCount()).toBe(0);
  });

  test("pulls events from other devices and stores them as already synced", async () => {
    const server = fakeServer();
    server.seed({ id: "11111111-1111-4111-8111-111111111111", type: "debt.set_initial", payload: { v: 1, prayer: "asr", count: 10 }, occurredAt: "2026-09-01T00:00:00.000Z", tz: "UTC", deviceId: "other" });

    const syncer = createSyncer(db, server.transport);
    await syncer.sync();

    const rows = await db.events.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].synced).toBe(1);
    expect(rows[0].serverSeq).toBe(1);
    expect(await syncer.cursor()).toBe(1);
  });

  test("syncing twice is idempotent and pulls only what is new", async () => {
    const server = fakeServer();
    await appendEvent(db, { type: "debt.set_initial", payload: { v: 1, prayer: "fajr", count: 4000 } });
    const syncer = createSyncer(db, server.transport);
    await syncer.sync();
    await syncer.sync();
    expect(await db.events.count()).toBe(1);

    server.seed({ id: "22222222-2222-4222-8222-222222222222", type: "debt.adjust", payload: { v: 1, prayer: "fajr", delta: 5 }, occurredAt: "2026-09-02T00:00:00.000Z", tz: "UTC", deviceId: "other" });
    await syncer.sync();
    expect(await db.events.count()).toBe(2);
    expect(await syncer.cursor()).toBe(2);
  });

  test("a failed push leaves events unsynced so the next run retries them", async () => {
    let fail = true;
    const server = fakeServer();
    const flaky: SyncTransport = {
      push: async (events) => {
        if (fail) throw new Error("offline");
        return server.transport.push(events);
      },
      pull: (since) => server.transport.pull(since),
    };
    await appendEvent(db, { type: "debt.set_initial", payload: { v: 1, prayer: "fajr", count: 1 } });
    const syncer = createSyncer(db, flaky);
    await expect(syncer.sync()).rejects.toThrow("offline");
    expect(await syncer.unsyncedCount()).toBe(1);
    fail = false;
    await syncer.sync();
    expect(await syncer.unsyncedCount()).toBe(0);
  });

  test("a pull result that includes an event we hold locally does not duplicate it", async () => {
    const server = fakeServer();
    const local = await appendEvent(db, { type: "debt.set_initial", payload: { v: 1, prayer: "fajr", count: 1 } });
    // Simulate: another device already pushed this same id (e.g. after a restore).
    server.seed(local);
    const syncer = createSyncer(db, server.transport);
    await syncer.sync();
    expect(await db.events.count()).toBe(1);
    expect((await db.events.get(local.id))?.synced).toBe(1);
  });

  test("pushes in batches no larger than the batch size", async () => {
    const server = fakeServer();
    const sizes: number[] = [];
    const counting: SyncTransport = {
      push: (events) => {
        sizes.push(events.length);
        return server.transport.push(events);
      },
      pull: (since) => server.transport.pull(since),
    };
    for (let i = 0; i < 7; i++) await appendEvent(db, { type: "debt.adjust", payload: { v: 1, prayer: "fajr", delta: 1 } });
    await createSyncer(db, counting, { batchSize: 3 }).sync();
    expect(sizes).toEqual([3, 3, 1]);
  });
});
