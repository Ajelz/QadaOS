/**
 * The ledger: an append-only list of events and a deterministic reducer.
 *
 * Nothing in the app stores debt. Debt, resolutions, periods and progress are all
 * derived from the event list by `reduce`. Undo is itself an event (`event.revoked`).
 */

import { perPrayer, type PerPrayer, type Prayer, type PrayerDay, type ResolutionStatus, type Strategy } from "./types";

interface EventBase {
  /** Client-generated UUID. Sync is a set union on this id. */
  id: string;
  /** When the act happened (user-editable, backdatable). ISO 8601 with offset or Z. */
  occurredAt: string;
  /** IANA timezone the event was recorded in. */
  tz: string;
  deviceId: string;
  /** Assigned by the server on receipt; absent while only local. */
  serverSeq?: number;
}

export type LedgerEvent = EventBase &
  (
    | { type: "debt.set_initial"; payload: { v: 1; prayer: Prayer; count: number } }
    | { type: "debt.adjust"; payload: { v: 1; prayer: Prayer; delta: number; note?: string } }
    | { type: "qada.logged"; payload: { v: 1; prayer: Prayer; count: number; prayerDay: PrayerDay } }
    | { type: "daily.resolved"; payload: { v: 1; prayerDay: PrayerDay; prayer: Prayer; status: ResolutionStatus } }
    | { type: "strategy.started"; payload: { v: 1 } & Strategy }
    | { type: "strategy.stopped"; payload: { v: 1; strategyId: string } }
    | { type: "event.revoked"; payload: { v: 1; target: string } }
  );

export type EventType = LedgerEvent["type"];

export interface Resolution {
  status: ResolutionStatus;
  eventId: string;
  occurredAt: string;
}

export interface Period {
  strategy: Strategy;
  startedAt: string;
  endedAt?: string;
  eventId: string;
}

export interface LedgerState {
  /** Confirmed debt per prayer. May be negative (a buffer past zero). */
  debt: PerPrayer<number>;
  /** Sum of positive debt across prayers. */
  totalOwed: number;
  /** Sum of debt below zero, as a positive number. */
  buffer: number;
  /** Initial estimate per prayer, latest `debt.set_initial` wins. */
  initial: PerPrayer<number>;
  /** Keyed `${prayerDay}|${prayer}`. */
  resolutions: Record<string, Resolution>;
  /** Qada logged per prayer day, per prayer. */
  qadaByDay: Record<PrayerDay, Partial<Record<Prayer, number>>>;
  periods: Period[];
  activeStrategy?: Strategy;
  revoked: Set<string>;
  /** Events that survived revocation, in canonical order. */
  events: LedgerEvent[];
}

export function resolutionKey(prayerDay: PrayerDay, prayer: Prayer): string {
  return `${prayerDay}|${prayer}`;
}

/** Canonical order: by occurredAt, then by id, so every device reduces identically. */
export function sortEvents(events: readonly LedgerEvent[]): LedgerEvent[] {
  return [...events].sort((a, b) => {
    if (a.occurredAt < b.occurredAt) return -1;
    if (a.occurredAt > b.occurredAt) return 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function emptyState(): LedgerState {
  return {
    debt: perPrayer(() => 0),
    totalOwed: 0,
    buffer: 0,
    initial: perPrayer(() => 0),
    resolutions: {},
    qadaByDay: {},
    periods: [],
    activeStrategy: undefined,
    revoked: new Set(),
    events: [],
  };
}

export function reduce(input: readonly LedgerEvent[]): LedgerState {
  const state = emptyState();

  // Revocations apply regardless of where they sit in the list.
  for (const e of input) {
    if (e.type === "event.revoked") state.revoked.add(e.payload.target);
  }

  const live = sortEvents(input).filter((e) => e.type !== "event.revoked" && !state.revoked.has(e.id));
  state.events = live;

  const adjustments = perPrayer(() => 0);
  const qadaTotal = perPrayer(() => 0);

  for (const e of live) {
    switch (e.type) {
      case "debt.set_initial":
        state.initial[e.payload.prayer] = e.payload.count;
        break;
      case "debt.adjust":
        adjustments[e.payload.prayer] += e.payload.delta;
        break;
      case "qada.logged": {
        const { prayer, count, prayerDay } = e.payload;
        qadaTotal[prayer] += count;
        const day = (state.qadaByDay[prayerDay] ??= {});
        day[prayer] = (day[prayer] ?? 0) + count;
        break;
      }
      case "daily.resolved": {
        const { prayerDay, prayer, status } = e.payload;
        // Sorted ascending, so the last one written wins.
        state.resolutions[resolutionKey(prayerDay, prayer)] = { status, eventId: e.id, occurredAt: e.occurredAt };
        break;
      }
      case "strategy.started": {
        const open = state.periods.find((p) => !p.endedAt);
        if (open) open.endedAt = e.occurredAt;
        const { strategyId, name, rules, order } = e.payload;
        state.periods.push({ strategy: { strategyId, name, rules, order }, startedAt: e.occurredAt, eventId: e.id });
        break;
      }
      case "strategy.stopped": {
        const open = state.periods.find((p) => !p.endedAt);
        if (open) open.endedAt = e.occurredAt;
        break;
      }
    }
  }

  const missed = perPrayer(() => 0);
  for (const [key, r] of Object.entries(state.resolutions)) {
    if (r.status === "missed") missed[key.split("|")[1] as Prayer] += 1;
  }

  state.debt = perPrayer((p) => state.initial[p] + adjustments[p] + missed[p] - qadaTotal[p]);
  state.totalOwed = Object.values(state.debt).reduce((s, d) => s + Math.max(0, d), 0);
  state.buffer = Object.values(state.debt).reduce((s, d) => s + Math.max(0, -d), 0);
  state.activeStrategy = state.periods.find((p) => !p.endedAt)?.strategy;

  return state;
}
