import { describe, expect, test } from "vitest";
import { activityBuckets } from "./activity";
import { emptyState } from "./ledger";

function stateWith(qada: Record<string, number>, missedDays: string[] = []) {
  const s = emptyState();
  for (const [day, n] of Object.entries(qada)) s.qadaByDay[day] = { fajr: n };
  for (const d of missedDays) s.resolutions[`${d}|asr`] = { status: "missed", eventId: d, occurredAt: "" };
  return s;
}

describe("activityBuckets", () => {
  test("7 days gives seven daily buckets ending today", () => {
    const b = activityBuckets(stateWith({ "2026-09-20": 3, "2026-09-14": 2, "2026-09-13": 9 }), "2026-09-20", 7);
    expect(b).toHaveLength(7);
    expect(b[0].start).toBe("2026-09-14");
    expect(b[0].qada).toBe(2);
    expect(b[6].start).toBe("2026-09-20");
    expect(b[6].qada).toBe(3);
    expect(b[6].isCurrent).toBe(true);
    expect(b.every((x) => x.start === x.end)).toBe(true);
  });

  test("30 days gives thirty daily buckets", () => {
    const b = activityBuckets(stateWith({ "2026-08-22": 4 }), "2026-09-20", 30);
    expect(b).toHaveLength(30);
    expect(b[0].start).toBe("2026-08-22");
    expect(b[0].qada).toBe(4);
  });

  test("90 days gives weekly buckets, the last one ending today", () => {
    const b = activityBuckets(stateWith({ "2026-09-20": 1, "2026-09-14": 2, "2026-09-13": 5 }), "2026-09-20", 90);
    expect(b).toHaveLength(13);
    const last = b.at(-1)!;
    expect(last.start).toBe("2026-09-14");
    expect(last.end).toBe("2026-09-20");
    expect(last.qada).toBe(3);
    expect(last.isCurrent).toBe(true);
    expect(b.at(-2)!.end).toBe("2026-09-13");
    expect(b.at(-2)!.qada).toBe(5);
  });

  test("counts missed daily prayers per bucket", () => {
    const b = activityBuckets(stateWith({}, ["2026-09-19", "2026-09-19", "2026-09-15"]), "2026-09-20", 7);
    expect(b[5].missed).toBe(1);
    expect(b[1].missed).toBe(1);
  });

  test("applies a per-prayer weight, for the rak'ah view", () => {
    const b = activityBuckets(stateWith({ "2026-09-20": 3 }), "2026-09-20", 7, () => 2);
    expect(b[6].qada).toBe(6);
  });
});
