/**
 * Bucketed activity for the Stats chart: daily bars for 7 and 30 days, weekly bars for 90.
 * Pure; the screen only draws what this returns.
 */

import type { LedgerState } from "./ledger";
import { shiftDay } from "./prayerDay";
import type { Prayer, PrayerDay } from "./types";

export type ActivityWindow = 7 | 30 | 90;

export interface ActivityBucket {
  start: PrayerDay;
  end: PrayerDay;
  qada: number;
  missed: number;
  /** The bucket that contains today. */
  isCurrent: boolean;
}

export function activityBuckets(state: Pick<LedgerState, "qadaByDay" | "resolutions">, today: PrayerDay, windowDays: ActivityWindow, weight: (p: Prayer) => number = () => 1): ActivityBucket[] {
  const missedByDay = new Map<PrayerDay, number>();
  for (const [key, r] of Object.entries(state.resolutions)) {
    if (r.status !== "missed") continue;
    const day = key.split("|")[0];
    missedByDay.set(day, (missedByDay.get(day) ?? 0) + 1);
  }

  const span = windowDays === 90 ? 7 : 1;
  const count = windowDays === 90 ? 13 : windowDays;
  const buckets: ActivityBucket[] = [];
  for (let k = 0; k < count; k++) {
    const end = shiftDay(today, -span * (count - 1 - k));
    const start = shiftDay(end, -(span - 1));
    let qada = 0;
    let missed = 0;
    for (let d = start; d <= end; d = shiftDay(d, 1)) {
      for (const [p, n] of Object.entries(state.qadaByDay[d] ?? {})) qada += (n ?? 0) * weight(p as Prayer);
      missed += missedByDay.get(d) ?? 0;
    }
    buckets.push({ start, end, qada, missed, isCurrent: k === count - 1 });
  }
  return buckets;
}
