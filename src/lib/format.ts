import type { PrayerDay } from "@/domain/types";

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function fmtTime(d: Date, tz?: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d).toLowerCase();
}

/** "12:31" for tight spaces such as prayer tiles; the prayer name disambiguates am/pm. */
export function fmtTimeShort(d: Date, tz?: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d).replace(/\s?[AP]M$/i, "");
}

function dayToDate(day: PrayerDay): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** "Sat 19 Sep" */
export function fmtDay(day: PrayerDay): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(dayToDate(day)).replace("Sept", "Sep");
}

/** "19 Sep 2026" */
export function fmtDayLong(day: PrayerDay): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(dayToDate(day));
}

/** "Apr 2031" */
export function fmtMonth(day: PrayerDay): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "numeric" }).format(dayToDate(day));
}

/** Hijri date via Intl, Umm al-Qura calendar, with the user's day offset. */
export function fmtHijri(day: PrayerDay, offsetDays = 0): string {
  const d = dayToDate(day);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  try {
    return new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(d).replace(/\s?AH$/, "");
  } catch {
    return "";
  }
}

export function fmtRelativeDays(days: number): string {
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  if (days < 60) return `${days} days`;
  const months = Math.round(days / 30.4);
  if (months < 24) return `${months} months`;
  const years = days / 365.25;
  return `${years.toFixed(years < 10 ? 1 : 0)} years`;
}

export function todayLocalIso(): string {
  return new Date().toISOString().slice(0, 10);
}
