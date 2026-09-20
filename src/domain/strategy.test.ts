import { describe, expect, test } from "vitest";
import { emptyState, type LedgerState } from "./ledger";
import { adherence, dailyTotals, daysBetween, paceFinish, progressFor, simulateFinish, targetsFor, TEMPLATES, uncoveredPrayers } from "./strategy";
import { perPrayer, type Prayer, type Strategy } from "./types";

const ORDER: Prayer[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

function withDebt(debt: Partial<Record<Prayer, number>>, extra: Partial<LedgerState> = {}): LedgerState {
  const s = emptyState();
  s.debt = perPrayer((p) => debt[p] ?? 0);
  return { ...s, ...extra };
}

const oneWithEach: Strategy = {
  strategyId: "owe",
  name: "One with each",
  order: ORDER,
  rules: ORDER.map((p) => ({ kind: "with_daily", daily: p, qada: "same", count: 1 })),
};

const fajrSprint: Strategy = {
  strategyId: "fs",
  name: "Fajr sprint",
  order: ORDER,
  rules: [
    { kind: "with_daily", daily: "fajr", qada: "same", count: 2 },
    { kind: "block", label: "Tonight", after: "isha", qada: "next_in_order", count: 3 },
  ],
};

describe("targetsFor", () => {
  test("'same' targets the daily prayer; a prayer with no debt produces no target", () => {
    const t = targetsFor(withDebt({ fajr: 10, dhuhr: 5 }), oneWithEach);
    expect(t.map((x) => [x.prayer, x.count])).toEqual([
      ["fajr", 1],
      ["dhuhr", 1],
    ]);
  });

  test("'next_in_order' targets the first prayer in order with debt above zero", () => {
    const t = targetsFor(withDebt({ asr: 4, isha: 9 }), fajrSprint);
    expect(t).toHaveLength(1);
    expect(t[0].prayer).toBe("asr");
    expect(t[0].count).toBe(3);
    // A block names the prayer it resolves to, so the target says what to actually pray.
    expect(t[0].label).toBe("Tonight: 3 Asr");
  });

  test("a specific prayer target is kept only while that prayer has debt", () => {
    const s: Strategy = { strategyId: "q", name: "Quota", order: ORDER, rules: [{ kind: "daily_quota", qada: "maghrib", count: 4 }] };
    expect(targetsFor(withDebt({ maghrib: 1 }), s)[0].prayer).toBe("maghrib");
    expect(targetsFor(withDebt({ fajr: 1 }), s)).toEqual([]);
  });

  test("targets carry their rule index so progress can be matched back", () => {
    const t = targetsFor(withDebt({ fajr: 10 }), fajrSprint);
    expect(t.map((x) => x.ruleIndex)).toEqual([0, 1]);
  });
});

describe("progressFor", () => {
  test("qada logged that day fills targets of the same prayer greedily in rule order", () => {
    const state = withDebt({ fajr: 100 }, { qadaByDay: { "2026-09-19": { fajr: 4 } } });
    const p = progressFor("2026-09-19", state, fajrSprint);
    expect(p.targets.map((t) => [t.prayer, t.count, t.done])).toEqual([
      ["fajr", 2, 2],
      ["fajr", 3, 2],
    ]);
    expect(p.totalTarget).toBe(5);
    expect(p.totalDone).toBe(4);
  });

  test("done never exceeds the target; the overflow is reported separately", () => {
    const state = withDebt({ fajr: 100 }, { qadaByDay: { "2026-09-19": { fajr: 9 } } });
    const p = progressFor("2026-09-19", state, fajrSprint);
    expect(p.totalDone).toBe(5);
    expect(p.extra).toBe(4);
  });

  test("a day with no logs has zero done", () => {
    const p = progressFor("2026-09-19", withDebt({ fajr: 100 }), fajrSprint);
    expect(p.totalDone).toBe(0);
    expect(p.extra).toBe(0);
  });
});

describe("daysBetween", () => {
  test("is inclusive of both ends", () => {
    expect(daysBetween("2026-09-28", "2026-10-02")).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });
  test("returns just the day when both ends match", () => {
    expect(daysBetween("2026-09-19", "2026-09-19")).toEqual(["2026-09-19"]);
  });
});

describe("adherence", () => {
  test("is the mean of min(done, target) / target over days with a target", () => {
    const state = withDebt(
      { fajr: 1000 },
      { qadaByDay: { "2026-09-19": { fajr: 5 }, "2026-09-20": { fajr: 0 }, "2026-09-21": { fajr: 10 } } },
    );
    // day1 5/5 = 1, day2 0/5 = 0, day3 capped 5/5 = 1 → 2/3
    expect(adherence(["2026-09-19", "2026-09-20", "2026-09-21"], state, fajrSprint)).toBeCloseTo(2 / 3, 5);
  });

  test("is undefined when no day had a target", () => {
    expect(adherence(["2026-09-19"], withDebt({}), fajrSprint)).toBeUndefined();
  });
});

describe("simulateFinish", () => {
  test("one with each on 4,000 per prayer finishes in 4,000 days", () => {
    const debt = perPrayer((p) => (p === "witr" ? 0 : 4000));
    const r = simulateFinish(debt, oneWithEach, "2026-09-19");
    expect(r?.days).toBe(4000);
  });

  test("walks type order once a column is cleared", () => {
    // fajr 10, dhuhr 6. Day1: 2+3 fajr → 5 left. Day2: → 0. Day3: block moves to dhuhr, 3 → 3 left. Day4: 0.
    const debt = perPrayer((p) => (p === "fajr" ? 10 : p === "dhuhr" ? 6 : 0));
    const r = simulateFinish(debt, fajrSprint, "2026-09-19");
    expect(r?.days).toBe(4);
    expect(r?.finishDay).toBe("2026-09-23");
  });

  test("returns zero days when nothing is owed", () => {
    const r = simulateFinish(perPrayer(() => 0), fajrSprint, "2026-09-19");
    expect(r).toEqual({ days: 0, finishDay: "2026-09-19" });
  });

  test("returns undefined when the strategy can make no progress", () => {
    const s: Strategy = { strategyId: "n", name: "Nothing", order: ORDER, rules: [] };
    expect(simulateFinish(perPrayer(() => 10), s, "2026-09-19")).toBeUndefined();
  });
});

describe("paceFinish", () => {
  test("uses net progress over the trailing window to project a finish day", () => {
    const qadaByDay: LedgerState["qadaByDay"] = {};
    for (const d of daysBetween("2026-08-21", "2026-09-19")) qadaByDay[d] = { fajr: 3 };
    const state = withDebt({ fajr: 300 }, { qadaByDay });
    const r = paceFinish(state, "2026-09-19", 30);
    expect(r.netPerDay).toBeCloseTo(3, 5);
    expect(r.finishDay).toBe("2026-12-28");
  });

  test("missed daily prayers in the window reduce the net pace", () => {
    const qadaByDay: LedgerState["qadaByDay"] = {};
    const resolutions: LedgerState["resolutions"] = {};
    for (const d of daysBetween("2026-08-21", "2026-09-19")) {
      qadaByDay[d] = { fajr: 1 };
      resolutions[`${d}|dhuhr`] = { status: "missed", eventId: d, occurredAt: "" };
    }
    const state = withDebt({ fajr: 300 }, { qadaByDay, resolutions });
    const r = paceFinish(state, "2026-09-19", 30);
    expect(r.netPerDay).toBeCloseTo(0, 5);
    expect(r.finishDay).toBeUndefined();
  });

  test("with nothing owed the finish day is today", () => {
    const r = paceFinish(withDebt({}), "2026-09-19", 30);
    expect(r.finishDay).toBe("2026-09-19");
  });
});

describe("TEMPLATES", () => {
  test("ship the four onboarding strategies", () => {
    expect(TEMPLATES.map((t) => t.name)).toEqual(["One with each", "Fajr first", "Full day", "Daily quota"]);
  });
  test("every template resolves to at least one target on a full debt", () => {
    const debt = withDebt(perPrayer(() => 100));
    for (const t of TEMPLATES) expect(targetsFor(debt, t.build(ORDER)).length).toBeGreaterThan(0);
  });
});

describe("uncoveredPrayers", () => {
  test("lists prayers that carry debt but that no rule can ever reach", () => {
    const s: Strategy = { strategyId: "x", name: "Fajr only", order: ["fajr"], rules: [{ kind: "with_daily", daily: "fajr", qada: "same", count: 2 }] };
    expect(uncoveredPrayers(withDebt({ fajr: 10, witr: 5, dhuhr: 0 }), s)).toEqual(["witr"]);
  });

  test("next_in_order covers every prayer in the order, and only those", () => {
    const s: Strategy = { strategyId: "x", name: "Quota", order: ["fajr", "dhuhr"], rules: [{ kind: "daily_quota", qada: "next_in_order", count: 5 }] };
    expect(uncoveredPrayers(withDebt({ fajr: 1, dhuhr: 1, witr: 3 }), s)).toEqual(["witr"]);
  });

  test("is empty when everything owed is covered", () => {
    expect(uncoveredPrayers(withDebt({ fajr: 1, isha: 1 }), oneWithEach)).toEqual([]);
  });
});

describe("dailyTotals", () => {
  test("gives what was owed at the end of each day that had activity, oldest first", () => {
    const events = [
      { id: "1", type: "debt.set_initial", occurredAt: "2026-09-01T08:00:00.000Z", tz: "UTC", deviceId: "d", payload: { v: 1, prayer: "fajr", count: 100 } },
      { id: "2", type: "qada.logged", occurredAt: "2026-09-01T09:00:00.000Z", tz: "UTC", deviceId: "d", payload: { v: 1, prayer: "fajr", count: 4, prayerDay: "2026-09-01" } },
      { id: "3", type: "daily.resolved", occurredAt: "2026-09-03T09:00:00.000Z", tz: "UTC", deviceId: "d", payload: { v: 1, prayer: "asr", prayerDay: "2026-09-03", status: "missed" } },
      { id: "4", type: "qada.logged", occurredAt: "2026-09-03T10:00:00.000Z", tz: "UTC", deviceId: "d", payload: { v: 1, prayer: "fajr", count: 10, prayerDay: "2026-09-03" } },
    ] as never;
    expect(dailyTotals(events)).toEqual([
      { day: "2026-09-01", owed: 96, qada: 4, missed: 0 },
      { day: "2026-09-03", owed: 87, qada: 10, missed: 1 },
    ]);
  });

  test("a backdated log lands on the day it was credited to", () => {
    const events = [
      { id: "1", type: "debt.set_initial", occurredAt: "2026-09-01T08:00:00.000Z", tz: "UTC", deviceId: "d", payload: { v: 1, prayer: "fajr", count: 50 } },
      { id: "2", type: "qada.logged", occurredAt: "2026-09-05T09:00:00.000Z", tz: "UTC", deviceId: "d", payload: { v: 1, prayer: "fajr", count: 5, prayerDay: "2026-09-02" } },
    ] as never;
    expect(dailyTotals(events).map((d) => [d.day, d.owed])).toEqual([
      ["2026-09-01", 50],
      ["2026-09-02", 45],
    ]);
  });
});
