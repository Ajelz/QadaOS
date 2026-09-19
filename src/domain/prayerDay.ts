/**
 * Prayer-day engine: turns settings + an instant into the prayer day, its windows,
 * the current window and the pending set. Wraps adhan-js. Pure; safe on client and server.
 *
 * A "prayer day" is anchored at Fajr: the stretch from one Fajr to the next belongs to
 * the local calendar date on which that Fajr fell.
 */

import { CalculationMethod, CalculationParameters, Coordinates, HighLatitudeRule, Madhab, PrayerTimes, SunnahTimes } from "adhan";
import type { Resolution } from "./ledger";
import { resolutionKey } from "./ledger";
import type { Prayer, PrayerDay } from "./types";

export type MethodName = keyof typeof CalculationMethod;
export type MadhabName = (typeof Madhab)[keyof typeof Madhab];
export type HighLatitudeRuleName = Exclude<(typeof HighLatitudeRule)[keyof typeof HighLatitudeRule], (...args: never[]) => unknown>;

export interface Location {
  lat: number;
  lng: number;
  /** IANA timezone of the location. */
  tz: string;
  label?: string;
}

export interface PrayerSettings {
  method: MethodName;
  madhab: MadhabName;
  highLatitudeRule: HighLatitudeRuleName;
  /** When the Isha window closes: at the next Fajr, or at Islamic midnight. */
  ishaEnd: "fajr" | "midnight";
  trackWitr: boolean;
  /** Absent means "no windows" mode: plain checkboxes, no pending logic. */
  location?: Location;
}

export const DEFAULT_PRAYER_SETTINGS: PrayerSettings = {
  method: "MuslimWorldLeague",
  madhab: "shafi",
  highLatitudeRule: "middleofthenight",
  ishaEnd: "fajr",
  trackWitr: false,
};

export interface PrayerWindow {
  prayer: Prayer;
  start: Date;
  end: Date;
}

export interface DaySchedule {
  prayerDay: PrayerDay;
  now: Date;
  /** Empty in no-windows mode. */
  windows: PrayerWindow[];
  /** The window containing `now`, if any. */
  current?: PrayerWindow;
  /** The first window starting after `now` on this prayer day, if any. */
  next?: PrayerWindow;
  /** Times for the day, useful for reminders. Absent in no-windows mode. */
  times?: { fajr: Date; sunrise: Date; dhuhr: Date; asr: Date; maghrib: Date; isha: Date };
}

/** YYYY-MM-DD for `date` as seen in `tz`. */
export function localDateString(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function shiftDay(day: PrayerDay, delta: number): PrayerDay {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function params(settings: PrayerSettings): CalculationParameters {
  const p = CalculationMethod[settings.method]();
  p.madhab = settings.madhab;
  p.highLatitudeRule = settings.highLatitudeRule;
  return p;
}

/**
 * adhan reads the process-local calendar fields of the Date it is given, so we hand it a
 * Date whose local fields equal the target calendar day. The instants it returns are absolute.
 */
function calendarDate(day: PrayerDay): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function timesFor(settings: PrayerSettings, loc: Location, day: PrayerDay) {
  return new PrayerTimes(new Coordinates(loc.lat, loc.lng), calendarDate(day), params(settings));
}

function windowsFor(settings: PrayerSettings, loc: Location, day: PrayerDay): { windows: PrayerWindow[]; times: PrayerTimes } {
  const t = timesFor(settings, loc, day);
  const ishaEnd = settings.ishaEnd === "midnight" ? new SunnahTimes(t).middleOfTheNight : timesFor(settings, loc, shiftDay(day, 1)).fajr;
  const windows: PrayerWindow[] = [
    { prayer: "fajr", start: t.fajr, end: t.sunrise },
    { prayer: "dhuhr", start: t.dhuhr, end: t.asr },
    { prayer: "asr", start: t.asr, end: t.maghrib },
    { prayer: "maghrib", start: t.maghrib, end: t.isha },
    { prayer: "isha", start: t.isha, end: ishaEnd },
  ];
  if (settings.trackWitr) windows.push({ prayer: "witr", start: t.isha, end: ishaEnd });
  return { windows, times: t };
}

/**
 * @param deviceTz fallback timezone for no-windows mode; defaults to the runtime's zone.
 */
export function scheduleFor(settings: PrayerSettings, now: Date, deviceTz?: string): DaySchedule {
  const loc = settings.location;
  if (!loc) {
    const tz = deviceTz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    return { prayerDay: localDateString(now, tz), now, windows: [] };
  }

  // Candidate day is the local civil date; if we are before that day's Fajr, we still
  // belong to the previous prayer day.
  let day = localDateString(now, loc.tz);
  let built = windowsFor(settings, loc, day);
  if (now.getTime() < built.times.fajr.getTime()) {
    day = shiftDay(day, -1);
    built = windowsFor(settings, loc, day);
  }

  const ms = now.getTime();
  const current = built.windows.find((w) => ms >= w.start.getTime() && ms < w.end.getTime() && w.prayer !== "witr");
  let next = built.windows.find((w) => w.start.getTime() > ms && w.prayer !== "witr");
  if (!next) {
    // After Isha closed (midnight mode) or otherwise past the last window: next is tomorrow's Fajr.
    const tomorrow = windowsFor(settings, loc, shiftDay(day, 1));
    next = tomorrow.windows[0];
  }

  const t = built.times;
  return {
    prayerDay: day,
    now,
    windows: built.windows,
    current,
    next,
    times: { fajr: t.fajr, sunrise: t.sunrise, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha },
  };
}

/** Prayers whose window has closed on this prayer day with no resolution, in day order. */
export function pendingPrayers(schedule: DaySchedule, resolutions: Record<string, Resolution>): Prayer[] {
  const ms = schedule.now.getTime();
  return schedule.windows
    .filter((w) => w.end.getTime() <= ms)
    .filter((w) => !resolutions[resolutionKey(schedule.prayerDay, w.prayer)])
    .map((w) => w.prayer);
}
