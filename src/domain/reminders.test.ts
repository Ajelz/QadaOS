import { describe, expect, test } from "vitest";
import type { PrayerSettings } from "./prayerDay";
import { scheduleFor } from "./prayerDay";
import { dueReminders } from "./reminders";
import type { SettingsDoc } from "./schemas";
import { SettingsDocSchema } from "./schemas";

const riyadh: PrayerSettings = {
  method: "MuslimWorldLeague",
  madhab: "shafi",
  highLatitudeRule: "middleofthenight",
  ishaEnd: "fajr",
  trackWitr: false,
  location: { lat: 24.7136, lng: 46.6753, tz: "Asia/Riyadh", label: "Riyadh" },
};

function settings(overrides: Partial<SettingsDoc["reminders"]> = {}): SettingsDoc {
  return SettingsDocSchema.parse({
    prayer: riyadh,
    reminders: { enabled: true, perPrayer: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true }, review: true, reviewOffsetMinutes: 45, ...overrides },
  });
}

const minutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

describe("dueReminders", () => {
  const day = scheduleFor(riyadh, new Date("2026-09-19T07:00:00Z"));
  const asrStart = day.windows[2].start;

  test("a prayer whose start fell inside the last window is due", () => {
    const due = dueReminders(settings(), minutes(asrStart, 2), 5);
    expect(due.map((d) => d.kind)).toEqual(["asr"]);
    expect(due[0].prayerDay).toBe("2026-09-19");
  });

  test("nothing is due when no start time fell inside the window", () => {
    expect(dueReminders(settings(), minutes(asrStart, 30), 5)).toEqual([]);
  });

  test("a start exactly at the window's lower bound is included, the upper bound is not", () => {
    expect(dueReminders(settings(), minutes(asrStart, 5), 5).map((d) => d.kind)).toEqual(["asr"]);
    expect(dueReminders(settings(), asrStart, 5)).toEqual([]);
  });

  test("a prayer switched off in settings is not due", () => {
    expect(dueReminders(settings({ perPrayer: { asr: false } }), minutes(asrStart, 2), 5)).toEqual([]);
  });

  test("the review nudge is due at Isha plus the offset, and carries Isha's prayer day", () => {
    const ishaStart = day.windows[4].start;
    const due = dueReminders(settings({ perPrayer: {} }), minutes(ishaStart, 46), 5);
    expect(due.map((d) => d.kind)).toEqual(["review"]);
    expect(due[0].prayerDay).toBe("2026-09-19");
  });

  test("a review nudge that lands after midnight still belongs to the previous prayer day", () => {
    const ishaStart = day.windows[4].start;
    // Isha in Riyadh is around 19:30 local; a 300-minute offset lands past midnight.
    const due = dueReminders(settings({ perPrayer: {}, reviewOffsetMinutes: 300 }), minutes(ishaStart, 301), 5);
    expect(due.map((d) => d.kind)).toEqual(["review"]);
    expect(due[0].prayerDay).toBe("2026-09-19");
  });

  test("reminders disabled or no location yields nothing", () => {
    expect(dueReminders(settings({ enabled: false }), minutes(asrStart, 2), 5)).toEqual([]);
    const noLoc = SettingsDocSchema.parse({ prayer: { ...riyadh, location: undefined }, reminders: { enabled: true, perPrayer: { asr: true } } });
    expect(dueReminders(noLoc, minutes(asrStart, 2), 5)).toEqual([]);
  });

  test("each due reminder carries a title and body ready to send", () => {
    const [due] = dueReminders(settings(), minutes(asrStart, 2), 5);
    expect(due.title).toMatch(/Asr/);
    expect(due.body.length).toBeGreaterThan(0);
  });
});
