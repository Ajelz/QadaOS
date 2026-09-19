/**
 * Core domain vocabulary. Pure TypeScript, no React, no DB.
 */

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha", "witr"] as const;
export type Prayer = (typeof PRAYERS)[number];

/** The five obligatory prayers, in day order. Witr is optional and tracked separately. */
export const FARD_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const satisfies readonly Prayer[];

export const RAKAH: Record<Prayer, number> = {
  fajr: 2,
  dhuhr: 4,
  asr: 4,
  maghrib: 3,
  isha: 4,
  witr: 3,
};

export const PRAYER_LABEL: Record<Prayer, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
  witr: "Witr",
};

/** A Fajr-anchored local calendar day, formatted YYYY-MM-DD. */
export type PrayerDay = string;

export type ResolutionStatus = "on_time" | "late" | "missed" | "exempt";

export type QadaTarget = Prayer | "same" | "next_in_order";

export type Rule =
  | { kind: "with_daily"; daily: Prayer; qada: QadaTarget; count: number }
  | { kind: "block"; label: string; after: Prayer | "any"; qada: Exclude<QadaTarget, "same">; count: number }
  | { kind: "daily_quota"; qada: Exclude<QadaTarget, "same">; count: number };

export interface Strategy {
  strategyId: string;
  name: string;
  rules: Rule[];
  /** Order used to resolve `next_in_order`: the first prayer in this list with debt above zero. */
  order: Prayer[];
}

export type PerPrayer<T> = Record<Prayer, T>;

export function perPrayer<T>(fill: (p: Prayer) => T): PerPrayer<T> {
  return {
    fajr: fill("fajr"),
    dhuhr: fill("dhuhr"),
    asr: fill("asr"),
    maghrib: fill("maghrib"),
    isha: fill("isha"),
    witr: fill("witr"),
  };
}
