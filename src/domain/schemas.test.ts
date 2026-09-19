import { describe, expect, test } from "vitest";
import { LedgerEventSchema, PushBodySchema, SettingsDocSchema } from "./schemas";

const base = {
  id: "5d1b4a5e-2b0a-4c1e-9f4d-6a7b8c9d0e1f",
  occurredAt: "2026-09-19T10:00:00.000Z",
  tz: "Asia/Riyadh",
  deviceId: "dev-1",
};

describe("LedgerEventSchema", () => {
  test("accepts a well-formed qada log", () => {
    const r = LedgerEventSchema.safeParse({ ...base, type: "qada.logged", payload: { v: 1, prayer: "fajr", count: 3, prayerDay: "2026-09-19" } });
    expect(r.success).toBe(true);
  });

  test("rejects a zero or negative qada count", () => {
    expect(LedgerEventSchema.safeParse({ ...base, type: "qada.logged", payload: { v: 1, prayer: "fajr", count: 0, prayerDay: "2026-09-19" } }).success).toBe(false);
  });

  test("rejects an unknown prayer", () => {
    expect(LedgerEventSchema.safeParse({ ...base, type: "qada.logged", payload: { v: 1, prayer: "jumuah", count: 1, prayerDay: "2026-09-19" } }).success).toBe(false);
  });

  test("rejects a malformed prayer day", () => {
    expect(LedgerEventSchema.safeParse({ ...base, type: "qada.logged", payload: { v: 1, prayer: "fajr", count: 1, prayerDay: "19/09/2026" } }).success).toBe(false);
  });

  test("rejects a non-UUID id and a serverSeq set by the client", () => {
    expect(LedgerEventSchema.safeParse({ ...base, id: "1", type: "debt.adjust", payload: { v: 1, prayer: "fajr", delta: 1 } }).success).toBe(false);
    const r = LedgerEventSchema.safeParse({ ...base, serverSeq: 5, type: "debt.adjust", payload: { v: 1, prayer: "fajr", delta: 1 } });
    expect(r.success && "serverSeq" in r.data).toBe(false);
  });

  test("validates strategy rules by kind", () => {
    const ok = LedgerEventSchema.safeParse({
      ...base,
      type: "strategy.started",
      payload: {
        v: 1,
        strategyId: "s1",
        name: "Fajr sprint",
        order: ["fajr", "dhuhr", "asr", "maghrib", "isha"],
        rules: [
          { kind: "with_daily", daily: "fajr", qada: "same", count: 2 },
          { kind: "block", label: "Tonight", after: "isha", qada: "next_in_order", count: 3 },
        ],
      },
    });
    expect(ok.success).toBe(true);
    const bad = LedgerEventSchema.safeParse({
      ...base,
      type: "strategy.started",
      payload: { v: 1, strategyId: "s1", name: "x", order: ["fajr"], rules: [{ kind: "block", label: "T", after: "isha", qada: "same", count: 3 }] },
    });
    expect(bad.success).toBe(false);
  });

  test("caps the strategy name length and rule count", () => {
    const r = LedgerEventSchema.safeParse({
      ...base,
      type: "strategy.started",
      payload: { v: 1, strategyId: "s1", name: "x".repeat(200), order: ["fajr"], rules: [] },
    });
    expect(r.success).toBe(false);
  });
});

describe("PushBodySchema", () => {
  test("accepts up to 1,000 events and rejects more", () => {
    const one = { ...base, type: "debt.adjust", payload: { v: 1, prayer: "fajr", delta: 1 } };
    expect(PushBodySchema.safeParse({ events: Array.from({ length: 1000 }, (_, i) => ({ ...one, id: `5d1b4a5e-2b0a-4c1e-9f4d-${String(i).padStart(12, "0")}` })) }).success).toBe(true);
    expect(PushBodySchema.safeParse({ events: Array.from({ length: 1001 }, () => one) }).success).toBe(false);
  });
});

describe("SettingsDocSchema", () => {
  test("fills defaults for a fresh user", () => {
    const r = SettingsDocSchema.parse({});
    expect(r.prayer.method).toBe("MuslimWorldLeague");
    expect(r.prayer.trackWitr).toBe(false);
    expect(r.reminders.enabled).toBe(false);
    expect(r.onboarded).toBe(false);
  });

  test("rejects an out-of-range latitude", () => {
    expect(SettingsDocSchema.safeParse({ prayer: { location: { lat: 95, lng: 0, tz: "UTC" } } }).success).toBe(false);
  });
});
