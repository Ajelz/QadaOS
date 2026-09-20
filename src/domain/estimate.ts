/**
 * Estimating a starting debt from two dates, and expressing a later re-estimate as
 * adjustments. Pure; used by onboarding and by Settings.
 */

import type { PerPrayer, Prayer } from "./types";

const DAY_MS = 86_400_000;
const DAYS_PER_MONTH = 30.44;

/**
 * Prayers owed of each kind between the day prayer became obligatory and the day regular
 * prayer began, less the days each month with no obligation. Undefined (never zero) when
 * the range is incomplete or reversed, so a bad range cannot be committed as "0".
 */
export function estimateFromDates(start: string, end: string, exemptDaysPerMonth: number): number | undefined {
  if (!start || !end || end < start) return undefined;
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / DAY_MS);
  if (!Number.isFinite(days)) return undefined;
  const exempt = (days / DAYS_PER_MONTH) * exemptDaysPerMonth;
  return Math.max(0, Math.round(days - exempt));
}

export interface ReestimateDelta {
  prayer: Prayer;
  /** The starting estimate as it stands: the initial number plus every adjustment so far. */
  from: number;
  to: number;
  delta: number;
}

/** The adjustments that move each prayer's starting estimate to `target`. Prayers that would not change are omitted. */
export function reestimateDeltas(prayers: Prayer[], initial: PerPrayer<number>, adjustments: PerPrayer<number>, target: number): ReestimateDelta[] {
  return prayers
    .map((prayer) => {
      const from = initial[prayer] + adjustments[prayer];
      return { prayer, from, to: target, delta: target - from };
    })
    .filter((d) => d.delta !== 0);
}
