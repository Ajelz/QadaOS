/**
 * Which reminders fall due for a user in a scheduler tick. Pure; the dispatcher
 * handles idempotence and delivery.
 */

import { scheduleFor, type PrayerSettings } from "./prayerDay";
import type { SettingsDoc } from "./schemas";
import { PRAYER_LABEL, type Prayer } from "./types";

export type ReminderKind = Prayer | "review";

export interface DueReminder {
  kind: ReminderKind;
  prayerDay: string;
  at: Date;
  title: string;
  body: string;
}

export function prayerSettingsFrom(doc: SettingsDoc): PrayerSettings {
  const p = doc.prayer;
  return {
    method: p.method,
    madhab: p.madhab,
    highLatitudeRule: p.highLatitudeRule,
    ishaEnd: p.ishaEnd,
    trackWitr: p.trackWitr,
    location: p.location,
  };
}

/**
 * Reminders whose moment fell in [now − windowMinutes, now). Half-open so a moment is
 * never picked up by two consecutive ticks.
 */
export function dueReminders(doc: SettingsDoc, now: Date, windowMinutes: number): DueReminder[] {
  if (!doc.reminders.enabled || !doc.prayer.location) return [];
  const settings = prayerSettingsFrom(doc);
  const schedule = scheduleFor(settings, now);
  const lower = now.getTime() - windowMinutes * 60_000;
  const upper = now.getTime();
  const inWindow = (d: Date) => d.getTime() >= lower && d.getTime() < upper;

  const due: DueReminder[] = [];
  for (const w of schedule.windows) {
    if (w.prayer === "witr") continue;
    if (!doc.reminders.perPrayer[w.prayer]) continue;
    if (!inWindow(w.start)) continue;
    const name = PRAYER_LABEL[w.prayer];
    due.push({
      kind: w.prayer,
      prayerDay: schedule.prayerDay,
      at: w.start,
      title: `${name} has begun`,
      body: `Time for ${name}. Tap when you've prayed.`,
    });
  }

  if (doc.reminders.review && schedule.times) {
    const at = new Date(schedule.times.isha.getTime() + doc.reminders.reviewOffsetMinutes * 60_000);
    if (inWindow(at)) {
      due.push({
        kind: "review",
        prayerDay: schedule.prayerDay,
        at,
        title: "Evening review",
        body: "Resolve today's pending prayers and log any qada you did.",
      });
    }
  }

  return due;
}
