import { describe, expect, test } from "vitest";
import { estimateFromDates, reestimateDeltas } from "./estimate";
import { perPrayer } from "./types";

describe("estimateFromDates", () => {
  test("counts the days between the two dates", () => {
    expect(estimateFromDates("2020-01-01", "2022-01-01", 0)).toBe(731);
  });

  test("removes exempt days in proportion to the months covered", () => {
    // 731 days is about 24.01 months; 6 exempt days a month removes about 144.
    expect(estimateFromDates("2020-01-01", "2022-01-01", 6)).toBe(587);
  });

  test("is undefined for a reversed or incomplete range, never zero", () => {
    expect(estimateFromDates("2022-01-01", "2020-01-01", 0)).toBeUndefined();
    expect(estimateFromDates("", "2020-01-01", 0)).toBeUndefined();
  });

  test("never goes below zero", () => {
    expect(estimateFromDates("2020-01-01", "2020-01-05", 30)).toBe(0);
  });
});

describe("reestimateDeltas", () => {
  test("gives the adjustment that moves each starting estimate to the new number", () => {
    const initial = perPrayer((p) => (p === "witr" ? 0 : 4000));
    const adjustments = perPrayer((p) => (p === "fajr" ? 200 : 0));
    const d = reestimateDeltas(["fajr", "dhuhr"], initial, adjustments, 4500);
    // Fajr already stands at 4200, so it needs 300 more; Dhuhr needs 500.
    expect(d).toEqual([
      { prayer: "fajr", from: 4200, to: 4500, delta: 300 },
      { prayer: "dhuhr", from: 4000, to: 4500, delta: 500 },
    ]);
  });

  test("omits prayers that would not change", () => {
    const initial = perPrayer(() => 100);
    expect(reestimateDeltas(["fajr"], initial, perPrayer(() => 0), 100)).toEqual([]);
  });
});
