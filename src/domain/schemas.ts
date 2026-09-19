/**
 * Runtime validation shared by client and server. Every event crossing the wire is
 * checked here before it is stored or reduced.
 */

import { z } from "zod";
import { PRAYERS } from "./types";

export const PrayerSchema = z.enum(PRAYERS);
export const PrayerDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const Count = z.number().int().min(1).max(100_000);
const Iso = z.string().datetime({ offset: true });

const RuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("with_daily"), daily: PrayerSchema, qada: z.union([PrayerSchema, z.literal("same"), z.literal("next_in_order")]), count: Count }),
  z.object({ kind: z.literal("block"), label: z.string().min(1).max(60), after: z.union([PrayerSchema, z.literal("any")]), qada: z.union([PrayerSchema, z.literal("next_in_order")]), count: Count }),
  z.object({ kind: z.literal("daily_quota"), qada: z.union([PrayerSchema, z.literal("next_in_order")]), count: Count }),
]);

export const StrategySchema = z.object({
  strategyId: z.string().min(1).max(64),
  name: z.string().min(1).max(60),
  rules: z.array(RuleSchema).max(12),
  order: z.array(PrayerSchema).min(1).max(6),
});

const Base = z.object({
  id: z.string().uuid(),
  occurredAt: Iso,
  tz: z.string().min(1).max(64),
  deviceId: z.string().min(1).max(64),
});

export const LedgerEventSchema = z.discriminatedUnion("type", [
  Base.extend({ type: z.literal("debt.set_initial"), payload: z.object({ v: z.literal(1), prayer: PrayerSchema, count: z.number().int().min(0).max(1_000_000) }) }),
  Base.extend({ type: z.literal("debt.adjust"), payload: z.object({ v: z.literal(1), prayer: PrayerSchema, delta: z.number().int().min(-1_000_000).max(1_000_000), note: z.string().max(200).optional() }) }),
  Base.extend({ type: z.literal("qada.logged"), payload: z.object({ v: z.literal(1), prayer: PrayerSchema, count: Count, prayerDay: PrayerDaySchema }) }),
  Base.extend({ type: z.literal("daily.resolved"), payload: z.object({ v: z.literal(1), prayerDay: PrayerDaySchema, prayer: PrayerSchema, status: z.enum(["on_time", "late", "missed", "exempt"]) }) }),
  Base.extend({ type: z.literal("strategy.started"), payload: StrategySchema.extend({ v: z.literal(1) }) }),
  Base.extend({ type: z.literal("strategy.stopped"), payload: z.object({ v: z.literal(1), strategyId: z.string().min(1).max(64) }) }),
  Base.extend({ type: z.literal("event.revoked"), payload: z.object({ v: z.literal(1), target: z.string().uuid() }) }),
]);

export type ValidatedEvent = z.infer<typeof LedgerEventSchema>;

export const PushBodySchema = z.object({
  events: z.array(LedgerEventSchema).min(1).max(1000),
});

export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  tz: z.string().min(1).max(64),
  label: z.string().max(80).optional(),
});

export const SettingsDocSchema = z.object({
  onboarded: z.boolean().default(false),
  prayer: z
    .object({
      method: z
        .enum(["MuslimWorldLeague", "Egyptian", "Karachi", "UmmAlQura", "Dubai", "MoonsightingCommittee", "NorthAmerica", "Kuwait", "Qatar", "Singapore", "Tehran", "Turkey"])
        .default("MuslimWorldLeague"),
      madhab: z.enum(["shafi", "hanafi"]).default("shafi"),
      highLatitudeRule: z.enum(["middleofthenight", "seventhofthenight", "twilightangle"]).default("middleofthenight"),
      ishaEnd: z.enum(["fajr", "midnight"]).default("fajr"),
      trackWitr: z.boolean().default(false),
      location: LocationSchema.optional(),
    })
    .prefault({}),
  reminders: z
    .object({
      enabled: z.boolean().default(false),
      perPrayer: z.partialRecord(PrayerSchema, z.boolean()).default({}),
      review: z.boolean().default(true),
      /** Minutes after Isha begins. */
      reviewOffsetMinutes: z.number().int().min(0).max(600).default(45),
    })
    .prefault({}),
  display: z
    .object({
      hijriOffsetDays: z.number().int().min(-2).max(2).default(0),
      rakahView: z.boolean().default(false),
    })
    .prefault({}),
});

export type SettingsDoc = z.infer<typeof SettingsDocSchema>;

export const SettingsPutSchema = z.object({
  doc: SettingsDocSchema,
  updatedAt: Iso,
});

export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(200) }),
});
