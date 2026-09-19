/**
 * Strategy engine: rules → today's targets, progress against them, adherence over a
 * period, and two projections (plan pace, actual pace). Pure; no I/O.
 */

import type { LedgerState } from "./ledger";
import { shiftDay } from "./prayerDay";
import { FARD_PRAYERS, type PerPrayer, type Prayer, type PrayerDay, type Rule, type Strategy } from "./types";

export interface Target {
  ruleIndex: number;
  rule: Rule;
  prayer: Prayer;
  count: number;
  label: string;
}

export interface TargetProgress extends Target {
  done: number;
}

export interface DayProgress {
  targets: TargetProgress[];
  totalTarget: number;
  totalDone: number;
  /** Qada logged that day beyond what the targets asked for. */
  extra: number;
}

function nextInOrder(debt: PerPrayer<number>, order: Prayer[]): Prayer | undefined {
  return order.find((p) => debt[p] > 0);
}

function describe(rule: Rule, prayer: Prayer): string {
  const name = prayer.charAt(0).toUpperCase() + prayer.slice(1);
  switch (rule.kind) {
    case "with_daily": {
      const daily = rule.daily.charAt(0).toUpperCase() + rule.daily.slice(1);
      return `${rule.count} ${name} with ${daily}`;
    }
    case "block":
      return rule.label;
    case "daily_quota":
      return `${rule.count} ${name} today`;
  }
}

/** Today's targets for a strategy given the current debt. Prayers with no debt yield no target. */
export function targetsFor(state: Pick<LedgerState, "debt">, strategy: Strategy): Target[] {
  const out: Target[] = [];
  strategy.rules.forEach((rule, ruleIndex) => {
    let prayer: Prayer | undefined;
    if (rule.qada === "same") prayer = rule.kind === "with_daily" ? rule.daily : undefined;
    else if (rule.qada === "next_in_order") prayer = nextInOrder(state.debt, strategy.order);
    else prayer = rule.qada;
    if (!prayer || state.debt[prayer] <= 0 || rule.count <= 0) return;
    out.push({ ruleIndex, rule, prayer, count: rule.count, label: describe(rule, prayer) });
  });
  return out;
}

/** Greedy: per prayer, logged qada fills that prayer's targets in rule order. */
export function progressFor(day: PrayerDay, state: Pick<LedgerState, "debt" | "qadaByDay">, strategy: Strategy): DayProgress {
  const targets = targetsFor(state, strategy);
  const logged: Partial<Record<Prayer, number>> = { ...(state.qadaByDay[day] ?? {}) };
  const withDone: TargetProgress[] = targets.map((t) => {
    const available = logged[t.prayer] ?? 0;
    const done = Math.min(available, t.count);
    logged[t.prayer] = available - done;
    return { ...t, done };
  });
  const totalTarget = withDone.reduce((s, t) => s + t.count, 0);
  const totalDone = withDone.reduce((s, t) => s + t.done, 0);
  const extra = Object.values(logged).reduce((s, n) => s + (n ?? 0), 0);
  return { targets: withDone, totalTarget, totalDone, extra };
}

/** Inclusive list of YYYY-MM-DD days from `start` to `end`. */
export function daysBetween(start: PrayerDay, end: PrayerDay): PrayerDay[] {
  const days: PrayerDay[] = [];
  for (let d = start; d <= end; d = shiftDay(d, 1)) days.push(d);
  return days;
}

/**
 * Mean over the given days of min(done, target) / target, ignoring days with no target.
 * Uses the current debt to derive targets for every day; good enough for a report, and
 * exact for the common case where the same prayers still carry debt.
 */
export function adherence(days: PrayerDay[], state: Pick<LedgerState, "debt" | "qadaByDay">, strategy: Strategy): number | undefined {
  let sum = 0;
  let n = 0;
  for (const day of days) {
    const p = progressFor(day, state, strategy);
    if (p.totalTarget === 0) continue;
    sum += p.totalDone / p.totalTarget;
    n += 1;
  }
  return n === 0 ? undefined : sum / n;
}

export interface Finish {
  days: number;
  finishDay: PrayerDay;
}

const MAX_SIM_DAYS = 36_500;

/** Day-by-day simulation of the strategy against the debt until every column is cleared. */
export function simulateFinish(debt: PerPrayer<number>, strategy: Strategy, fromDay: PrayerDay): Finish | undefined {
  const d: PerPrayer<number> = { ...debt };
  const owed = () => Object.values(d).some((x) => x > 0);
  if (!owed()) return { days: 0, finishDay: fromDay };
  for (let day = 1; day <= MAX_SIM_DAYS; day++) {
    const targets = targetsFor({ debt: d }, strategy);
    if (targets.length === 0) return undefined;
    for (const t of targets) d[t.prayer] -= t.count;
    if (!owed()) return { days: day, finishDay: shiftDay(fromDay, day) };
  }
  return undefined;
}

export interface Pace {
  netPerDay: number;
  qadaPerDay: number;
  missedPerDay: number;
  /** Undefined when the net pace is zero or negative and something is still owed. */
  finishDay?: PrayerDay;
  daysToFinish?: number;
}

/** Actual pace: (qada logged − daily prayers missed) per day over the trailing window. */
export function paceFinish(state: Pick<LedgerState, "debt" | "qadaByDay" | "resolutions">, today: PrayerDay, trailingDays = 30): Pace {
  const start = shiftDay(today, -(trailingDays - 1));
  let qada = 0;
  let missed = 0;
  for (const [day, byPrayer] of Object.entries(state.qadaByDay)) {
    if (day < start || day > today) continue;
    qada += Object.values(byPrayer).reduce((s, n) => s + (n ?? 0), 0);
  }
  for (const [key, r] of Object.entries(state.resolutions)) {
    const day = key.split("|")[0];
    if (day < start || day > today) continue;
    if (r.status === "missed") missed += 1;
  }
  const qadaPerDay = qada / trailingDays;
  const missedPerDay = missed / trailingDays;
  const netPerDay = qadaPerDay - missedPerDay;
  const totalOwed = Object.values(state.debt).reduce((s, x) => s + Math.max(0, x), 0);
  if (totalOwed === 0) return { netPerDay, qadaPerDay, missedPerDay, finishDay: today, daysToFinish: 0 };
  if (netPerDay <= 0) return { netPerDay, qadaPerDay, missedPerDay };
  const daysToFinish = Math.ceil(totalOwed / netPerDay);
  return { netPerDay, qadaPerDay, missedPerDay, daysToFinish, finishDay: shiftDay(today, daysToFinish) };
}

export interface Template {
  id: string;
  name: string;
  description: string;
  build: (order: Prayer[]) => Strategy;
}

const newId = () => crypto.randomUUID();

export const TEMPLATES: Template[] = [
  {
    id: "one_with_each",
    name: "One with each",
    description: "After each daily prayer, make up one of the same prayer.",
    build: (order) => ({
      strategyId: newId(),
      name: "One with each",
      order,
      rules: FARD_PRAYERS.map((p) => ({ kind: "with_daily", daily: p, qada: "same", count: 1 })),
    }),
  },
  {
    id: "fajr_first",
    name: "Fajr first",
    description: "Two Fajr with Fajr, three more at night, then move down the order.",
    build: (order) => ({
      strategyId: newId(),
      name: "Fajr first",
      order,
      rules: [
        { kind: "with_daily", daily: "fajr", qada: "same", count: 2 },
        { kind: "block", label: "Tonight", after: "isha", qada: "next_in_order", count: 3 },
      ],
    }),
  },
  {
    id: "full_day",
    name: "Full day",
    description: "One complete missed day every night: one of each prayer.",
    build: (order) => ({
      strategyId: newId(),
      name: "Full day",
      order,
      rules: FARD_PRAYERS.map((p) => ({ kind: "block", label: `Tonight: ${p}`, after: "isha", qada: p, count: 1 })),
    }),
  },
  {
    id: "daily_quota",
    name: "Daily quota",
    description: "A fixed number every day of whatever is next in your order.",
    build: (order) => ({
      strategyId: newId(),
      name: "Daily quota",
      order,
      rules: [{ kind: "daily_quota", qada: "next_in_order", count: 10 }],
    }),
  },
];
