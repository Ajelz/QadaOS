"use client";

import { useEffect, useMemo, useState } from "react";
import type { LedgerState } from "@/domain/ledger";
import { pendingPrayers, scheduleFor, type DaySchedule } from "@/domain/prayerDay";
import { prayerSettingsFrom } from "@/domain/reminders";
import type { SettingsDoc } from "@/domain/schemas";
import { FARD_PRAYERS, type Prayer } from "@/domain/types";

/** A clock that ticks on an interval so windows flip without a reload. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    const onVisible = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}

export function trackedPrayers(settings: SettingsDoc): Prayer[] {
  return settings.prayer.trackWitr ? [...FARD_PRAYERS, "witr"] : [...FARD_PRAYERS];
}

export function useSchedule(settings: SettingsDoc, state: LedgerState, now: Date): { schedule: DaySchedule; pending: Prayer[]; hasWindows: boolean } {
  const schedule = useMemo(() => scheduleFor(prayerSettingsFrom(settings), now), [settings, now]);
  const pending = useMemo(() => pendingPrayers(schedule, state.resolutions), [schedule, state.resolutions]);
  return { schedule, pending, hasWindows: schedule.windows.length > 0 };
}
