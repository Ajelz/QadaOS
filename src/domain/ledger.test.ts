import { describe, expect, test } from "vitest";
import { reduce, type LedgerEvent } from "./ledger";

const at = (iso: string) => iso;
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function ev<T extends LedgerEvent["type"]>(
  type: T,
  payload: Extract<LedgerEvent, { type: T }>["payload"],
  occurredAt = at("2026-09-19T10:00:00.000Z"),
): LedgerEvent {
  return {
    id: id(),
    type,
    payload,
    occurredAt,
    tz: "Asia/Riyadh",
    deviceId: "test",
  } as LedgerEvent;
}

describe("reduce: debt", () => {
  test("initial debt minus logged qada gives remaining debt", () => {
    const state = reduce([
      ev("debt.set_initial", { v: 1, prayer: "fajr", count: 4000 }),
      ev("qada.logged", { v: 1, prayer: "fajr", count: 3, prayerDay: "2026-09-19" }),
    ]);
    expect(state.debt.fajr).toBe(3997);
  });

  test("prayers with no initial debt read as zero", () => {
    const state = reduce([ev("debt.set_initial", { v: 1, prayer: "fajr", count: 10 })]);
    expect(state.debt.dhuhr).toBe(0);
    expect(state.debt.witr).toBe(0);
  });

  test("a later set_initial for the same prayer replaces the earlier one", () => {
    const state = reduce([
      ev("debt.set_initial", { v: 1, prayer: "asr", count: 100 }, "2026-09-01T00:00:00.000Z"),
      ev("debt.set_initial", { v: 1, prayer: "asr", count: 250 }, "2026-09-02T00:00:00.000Z"),
    ]);
    expect(state.debt.asr).toBe(250);
  });

  test("debt.adjust adds its delta, positive or negative", () => {
    const state = reduce([
      ev("debt.set_initial", { v: 1, prayer: "isha", count: 100 }),
      ev("debt.adjust", { v: 1, prayer: "isha", delta: 25, note: "recounted" }),
      ev("debt.adjust", { v: 1, prayer: "isha", delta: -5 }),
    ]);
    expect(state.debt.isha).toBe(120);
  });

  test("a missed daily prayer adds one; on_time, late and exempt add nothing", () => {
    const state = reduce([
      ev("debt.set_initial", { v: 1, prayer: "dhuhr", count: 10 }),
      ev("daily.resolved", { v: 1, prayerDay: "2026-09-15", prayer: "dhuhr", status: "missed" }),
      ev("daily.resolved", { v: 1, prayerDay: "2026-09-16", prayer: "dhuhr", status: "on_time" }),
      ev("daily.resolved", { v: 1, prayerDay: "2026-09-17", prayer: "dhuhr", status: "late" }),
      ev("daily.resolved", { v: 1, prayerDay: "2026-09-18", prayer: "dhuhr", status: "exempt" }),
    ]);
    expect(state.debt.dhuhr).toBe(11);
  });

  test("the latest resolution for a day and prayer wins", () => {
    const state = reduce([
      ev("debt.set_initial", { v: 1, prayer: "fajr", count: 10 }),
      ev("daily.resolved", { v: 1, prayerDay: "2026-09-15", prayer: "fajr", status: "missed" }, "2026-09-15T12:00:00.000Z"),
      ev("daily.resolved", { v: 1, prayerDay: "2026-09-15", prayer: "fajr", status: "late" }, "2026-09-15T13:00:00.000Z"),
    ]);
    expect(state.debt.fajr).toBe(10);
    expect(state.resolutions["2026-09-15|fajr"]?.status).toBe("late");
  });

  test("debt can go below zero and is reported as a buffer", () => {
    const state = reduce([
      ev("debt.set_initial", { v: 1, prayer: "fajr", count: 2 }),
      ev("qada.logged", { v: 1, prayer: "fajr", count: 5, prayerDay: "2026-09-19" }),
    ]);
    expect(state.debt.fajr).toBe(-3);
    expect(state.totalOwed).toBe(0);
    expect(state.buffer).toBe(3);
  });
});

describe("reduce: revocation", () => {
  test("a revoked qada log no longer counts", () => {
    const log = ev("qada.logged", { v: 1, prayer: "fajr", count: 3, prayerDay: "2026-09-19" });
    const state = reduce([
      ev("debt.set_initial", { v: 1, prayer: "fajr", count: 10 }),
      log,
      ev("event.revoked", { v: 1, target: log.id }),
    ]);
    expect(state.debt.fajr).toBe(10);
    expect(state.revoked.has(log.id)).toBe(true);
  });

  test("revoking a resolution reopens it (no resolution remains)", () => {
    const res = ev("daily.resolved", { v: 1, prayerDay: "2026-09-15", prayer: "asr", status: "missed" });
    const state = reduce([
      ev("debt.set_initial", { v: 1, prayer: "asr", count: 10 }),
      res,
      ev("event.revoked", { v: 1, target: res.id }),
    ]);
    expect(state.debt.asr).toBe(10);
    expect(state.resolutions["2026-09-15|asr"]).toBeUndefined();
  });

  test("revoking twice is idempotent", () => {
    const log = ev("qada.logged", { v: 1, prayer: "fajr", count: 3, prayerDay: "2026-09-19" });
    const state = reduce([
      ev("debt.set_initial", { v: 1, prayer: "fajr", count: 10 }),
      log,
      ev("event.revoked", { v: 1, target: log.id }),
      ev("event.revoked", { v: 1, target: log.id }),
    ]);
    expect(state.debt.fajr).toBe(10);
  });

  test("a revocation that arrives before its target in the array still applies", () => {
    const log = ev("qada.logged", { v: 1, prayer: "fajr", count: 3, prayerDay: "2026-09-19" }, "2026-09-19T10:00:00.000Z");
    const revoke = ev("event.revoked", { v: 1, target: log.id }, "2026-09-19T11:00:00.000Z");
    const state = reduce([revoke, ev("debt.set_initial", { v: 1, prayer: "fajr", count: 10 }), log]);
    expect(state.debt.fajr).toBe(10);
  });
});

describe("reduce: ordering and determinism", () => {
  test("result is independent of input order", () => {
    const events = [
      ev("debt.set_initial", { v: 1, prayer: "fajr", count: 100 }, "2026-09-01T00:00:00.000Z"),
      ev("qada.logged", { v: 1, prayer: "fajr", count: 4, prayerDay: "2026-09-02" }, "2026-09-02T05:00:00.000Z"),
      ev("daily.resolved", { v: 1, prayerDay: "2026-09-02", prayer: "fajr", status: "missed" }, "2026-09-02T09:00:00.000Z"),
      ev("daily.resolved", { v: 1, prayerDay: "2026-09-02", prayer: "fajr", status: "late" }, "2026-09-02T10:00:00.000Z"),
      ev("debt.adjust", { v: 1, prayer: "fajr", delta: 7 }, "2026-09-03T00:00:00.000Z"),
    ];
    const a = reduce(events);
    const b = reduce([...events].reverse());
    const c = reduce([events[2], events[4], events[0], events[3], events[1]]);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(a.debt.fajr).toBe(103);
  });

  test("qada logs are grouped by prayer day", () => {
    const state = reduce([
      ev("qada.logged", { v: 1, prayer: "fajr", count: 2, prayerDay: "2026-09-18" }),
      ev("qada.logged", { v: 1, prayer: "fajr", count: 1, prayerDay: "2026-09-19" }),
      ev("qada.logged", { v: 1, prayer: "dhuhr", count: 3, prayerDay: "2026-09-19" }),
    ]);
    expect(state.qadaByDay["2026-09-18"]).toEqual({ fajr: 2 });
    expect(state.qadaByDay["2026-09-19"]).toEqual({ fajr: 1, dhuhr: 3 });
  });
});

describe("reduce: strategy periods", () => {
  const strategy = {
    strategyId: "s1",
    name: "One with each",
    rules: [{ kind: "with_daily" as const, daily: "fajr" as const, qada: "same" as const, count: 1 }],
    order: ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const,
  };

  test("starting a strategy opens a period with no end", () => {
    const state = reduce([ev("strategy.started", { v: 1, ...strategy, order: [...strategy.order] }, "2026-06-01T03:00:00.000Z")]);
    expect(state.periods).toHaveLength(1);
    expect(state.periods[0].startedAt).toBe("2026-06-01T03:00:00.000Z");
    expect(state.periods[0].endedAt).toBeUndefined();
    expect(state.activeStrategy?.name).toBe("One with each");
  });

  test("starting a second strategy closes the first at the second's start", () => {
    const state = reduce([
      ev("strategy.started", { v: 1, ...strategy, order: [...strategy.order] }, "2026-06-01T03:00:00.000Z"),
      ev("strategy.started", { v: 1, ...strategy, strategyId: "s2", name: "Fajr sprint", order: [...strategy.order] }, "2026-09-20T03:00:00.000Z"),
    ]);
    expect(state.periods).toHaveLength(2);
    expect(state.periods[0].endedAt).toBe("2026-09-20T03:00:00.000Z");
    expect(state.activeStrategy?.strategyId).toBe("s2");
  });

  test("stopping closes the open period and leaves no active strategy", () => {
    const state = reduce([
      ev("strategy.started", { v: 1, ...strategy, order: [...strategy.order] }, "2026-06-01T03:00:00.000Z"),
      ev("strategy.stopped", { v: 1, strategyId: "s1" }, "2026-07-01T03:00:00.000Z"),
    ]);
    expect(state.periods[0].endedAt).toBe("2026-07-01T03:00:00.000Z");
    expect(state.activeStrategy).toBeUndefined();
  });
});

describe("reduce: restoring an undone event", () => {
  test("revoking a revocation brings the original event back", () => {
    const log = ev("qada.logged", { v: 1, prayer: "fajr", count: 3, prayerDay: "2026-09-19" }, "2026-09-19T10:00:00.000Z");
    const undo = ev("event.revoked", { v: 1, target: log.id }, "2026-09-19T10:01:00.000Z");
    const redo = ev("event.revoked", { v: 1, target: undo.id }, "2026-09-19T10:02:00.000Z");
    const state = reduce([ev("debt.set_initial", { v: 1, prayer: "fajr", count: 10 }, "2026-09-19T09:00:00.000Z"), log, undo, redo]);
    expect(state.debt.fajr).toBe(7);
    expect(state.revoked.has(log.id)).toBe(false);
  });

  test("a restored event can be undone again", () => {
    const log = ev("qada.logged", { v: 1, prayer: "fajr", count: 3, prayerDay: "2026-09-19" }, "2026-09-19T10:00:00.000Z");
    const undo = ev("event.revoked", { v: 1, target: log.id }, "2026-09-19T10:01:00.000Z");
    const redo = ev("event.revoked", { v: 1, target: undo.id }, "2026-09-19T10:02:00.000Z");
    const undoAgain = ev("event.revoked", { v: 1, target: log.id }, "2026-09-19T10:03:00.000Z");
    const state = reduce([ev("debt.set_initial", { v: 1, prayer: "fajr", count: 10 }, "2026-09-19T09:00:00.000Z"), log, undo, redo, undoAgain]);
    expect(state.debt.fajr).toBe(10);
  });

  test("undone events are listed with the revocation that can restore them", () => {
    const log = ev("qada.logged", { v: 1, prayer: "fajr", count: 3, prayerDay: "2026-09-19" }, "2026-09-19T10:00:00.000Z");
    const undo = ev("event.revoked", { v: 1, target: log.id }, "2026-09-19T10:01:00.000Z");
    const state = reduce([log, undo]);
    expect(state.undone).toHaveLength(1);
    expect(state.undone[0].event.id).toBe(log.id);
    expect(state.undone[0].revokerId).toBe(undo.id);
    expect(state.undone[0].undoneAt).toBe("2026-09-19T10:01:00.000Z");
  });

  test("a restored event is no longer listed as undone", () => {
    const log = ev("qada.logged", { v: 1, prayer: "fajr", count: 3, prayerDay: "2026-09-19" }, "2026-09-19T10:00:00.000Z");
    const undo = ev("event.revoked", { v: 1, target: log.id }, "2026-09-19T10:01:00.000Z");
    const redo = ev("event.revoked", { v: 1, target: undo.id }, "2026-09-19T10:02:00.000Z");
    expect(reduce([log, undo, redo]).undone).toEqual([]);
  });

  test("restoration is independent of input order", () => {
    const log = ev("qada.logged", { v: 1, prayer: "fajr", count: 3, prayerDay: "2026-09-19" }, "2026-09-19T10:00:00.000Z");
    const undo = ev("event.revoked", { v: 1, target: log.id }, "2026-09-19T10:01:00.000Z");
    const redo = ev("event.revoked", { v: 1, target: undo.id }, "2026-09-19T10:02:00.000Z");
    const init = ev("debt.set_initial", { v: 1, prayer: "fajr", count: 10 }, "2026-09-19T09:00:00.000Z");
    expect(reduce([redo, undo, log, init]).debt.fajr).toBe(7);
    expect(reduce([undo, init, redo, log]).debt.fajr).toBe(7);
  });
});
