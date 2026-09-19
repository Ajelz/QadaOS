import { describe, expect, test } from "vitest";
import { localDateString, pendingPrayers, scheduleFor, type PrayerSettings } from "./prayerDay";

const riyadh: PrayerSettings = {
  method: "MuslimWorldLeague",
  madhab: "shafi",
  highLatitudeRule: "middleofthenight",
  ishaEnd: "fajr",
  trackWitr: false,
  location: { lat: 24.7136, lng: 46.6753, tz: "Asia/Riyadh", label: "Riyadh" },
};

const minutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

describe("localDateString", () => {
  test("formats the calendar date in the given timezone", () => {
    expect(localDateString(new Date("2026-09-19T22:00:00Z"), "Asia/Riyadh")).toBe("2026-09-20");
    expect(localDateString(new Date("2026-09-19T22:00:00Z"), "America/Los_Angeles")).toBe("2026-09-19");
  });
});

describe("scheduleFor: windows", () => {
  test("mid-morning on 19 Sep belongs to prayer day 2026-09-19 with five windows", () => {
    const s = scheduleFor(riyadh, new Date("2026-09-19T07:00:00Z"));
    expect(s.prayerDay).toBe("2026-09-19");
    expect(s.windows.map((w) => w.prayer)).toEqual(["fajr", "dhuhr", "asr", "maghrib", "isha"]);
  });

  test("windows are contiguous from Dhuhr to Isha and Fajr ends at sunrise", () => {
    const s = scheduleFor(riyadh, new Date("2026-09-19T07:00:00Z"));
    const [fajr, dhuhr, asr, maghrib, isha] = s.windows;
    expect(fajr.end.getTime()).toBeLessThan(dhuhr.start.getTime());
    expect(dhuhr.end.getTime()).toBe(asr.start.getTime());
    expect(asr.end.getTime()).toBe(maghrib.start.getTime());
    expect(maghrib.end.getTime()).toBe(isha.start.getTime());
    expect(isha.end.getTime()).toBeGreaterThan(isha.start.getTime());
  });

  test("Riyadh Fajr on 19 Sep 2026 starts between 04:00 and 05:00 local time", () => {
    const s = scheduleFor(riyadh, new Date("2026-09-19T07:00:00Z"));
    const fajrLocal = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hour12: false }).format(s.windows[0].start);
    expect(fajrLocal >= "04:00" && fajrLocal < "05:00").toBe(true);
  });

  test("Isha ends at the next day's Fajr by default", () => {
    const s = scheduleFor(riyadh, new Date("2026-09-19T07:00:00Z"));
    const tomorrow = scheduleFor(riyadh, new Date("2026-09-20T07:00:00Z"));
    expect(s.windows[4].end.getTime()).toBe(tomorrow.windows[0].start.getTime());
  });

  test("Isha ends at Islamic midnight when configured", () => {
    const s = scheduleFor({ ...riyadh, ishaEnd: "midnight" }, new Date("2026-09-19T07:00:00Z"));
    const isha = s.windows[4];
    const localHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", hour12: false }).format(isha.end));
    expect(localHour === 23 || localHour === 0).toBe(true);
  });

  test("Witr adds a sixth window that matches Isha when tracked", () => {
    const s = scheduleFor({ ...riyadh, trackWitr: true }, new Date("2026-09-19T07:00:00Z"));
    expect(s.windows.map((w) => w.prayer)).toEqual(["fajr", "dhuhr", "asr", "maghrib", "isha", "witr"]);
    expect(s.windows[5].start.getTime()).toBe(s.windows[4].start.getTime());
    expect(s.windows[5].end.getTime()).toBe(s.windows[4].end.getTime());
  });

  test("Hanafi Asr starts later than standard Asr", () => {
    const shafi = scheduleFor(riyadh, new Date("2026-09-19T07:00:00Z"));
    const hanafi = scheduleFor({ ...riyadh, madhab: "hanafi" }, new Date("2026-09-19T07:00:00Z"));
    expect(hanafi.windows[2].start.getTime()).toBeGreaterThan(shafi.windows[2].start.getTime());
  });
});

describe("scheduleFor: prayer-day boundary", () => {
  test("before Fajr, the instant belongs to the previous prayer day and its Isha window is current", () => {
    const day19 = scheduleFor(riyadh, new Date("2026-09-19T07:00:00Z"));
    const beforeFajr = minutes(day19.windows[0].start, -30);
    const s = scheduleFor(riyadh, beforeFajr);
    expect(s.prayerDay).toBe("2026-09-18");
    expect(s.current?.prayer).toBe("isha");
  });

  test("one minute after Fajr begins, the prayer day flips and Fajr is current", () => {
    const day19 = scheduleFor(riyadh, new Date("2026-09-19T07:00:00Z"));
    const s = scheduleFor(riyadh, minutes(day19.windows[0].start, 1));
    expect(s.prayerDay).toBe("2026-09-19");
    expect(s.current?.prayer).toBe("fajr");
  });

  test("between sunrise and Dhuhr there is no current window and Dhuhr is next", () => {
    const day19 = scheduleFor(riyadh, new Date("2026-09-19T07:00:00Z"));
    const s = scheduleFor(riyadh, minutes(day19.windows[0].end, 5));
    expect(s.current).toBeUndefined();
    expect(s.next?.prayer).toBe("dhuhr");
  });

  test("after Islamic midnight with ishaEnd=midnight, nothing is current but the day is unchanged until Fajr", () => {
    const settings = { ...riyadh, ishaEnd: "midnight" as const };
    const day19 = scheduleFor(settings, new Date("2026-09-19T07:00:00Z"));
    const s = scheduleFor(settings, minutes(day19.windows[4].end, 10));
    expect(s.prayerDay).toBe("2026-09-19");
    expect(s.current).toBeUndefined();
    expect(s.next?.prayer).toBe("fajr");
  });
});

describe("scheduleFor: no location", () => {
  test("returns the civil date in the device timezone and no windows", () => {
    const s = scheduleFor({ ...riyadh, location: undefined }, new Date("2026-09-19T22:30:00Z"), "Asia/Riyadh");
    expect(s.prayerDay).toBe("2026-09-20");
    expect(s.windows).toEqual([]);
    expect(s.current).toBeUndefined();
  });
});

describe("pendingPrayers", () => {
  test("windows that have closed without a resolution are pending, in day order", () => {
    const day19 = scheduleFor(riyadh, new Date("2026-09-19T07:00:00Z"));
    const duringAsr = minutes(day19.windows[2].start, 1);
    const s = scheduleFor(riyadh, duringAsr);
    expect(pendingPrayers(s, {})).toEqual(["fajr", "dhuhr"]);
  });

  test("a resolved prayer is not pending, whatever its status", () => {
    const day19 = scheduleFor(riyadh, new Date("2026-09-19T07:00:00Z"));
    const s = scheduleFor(riyadh, minutes(day19.windows[2].start, 1));
    const resolutions = {
      "2026-09-19|fajr": { status: "late" as const, eventId: "x", occurredAt: "" },
    };
    expect(pendingPrayers(s, resolutions)).toEqual(["dhuhr"]);
  });

  test("the current window is never pending", () => {
    const day19 = scheduleFor(riyadh, new Date("2026-09-19T07:00:00Z"));
    const s = scheduleFor(riyadh, minutes(day19.windows[0].start, 1));
    expect(pendingPrayers(s, {})).toEqual([]);
  });

  test("no-location mode has nothing pending", () => {
    const s = scheduleFor({ ...riyadh, location: undefined }, new Date("2026-09-19T22:30:00Z"), "Asia/Riyadh");
    expect(pendingPrayers(s, {})).toEqual([]);
  });
});
