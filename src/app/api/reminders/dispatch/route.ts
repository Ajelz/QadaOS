import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import webpush from "web-push";
import { pushSubscriptions, reminderDispatches, userSettings } from "@/db/schema";
import { dueReminders } from "@/domain/reminders";
import { SettingsDocSchema } from "@/domain/schemas";
import { db } from "@/lib/db";
import { envOptional } from "@/lib/env";
import { errorResponse, ErrorCode, handle } from "@/lib/errors";

/** Vercel Functions: give a large user base room; typical runs take well under a second. */
export const maxDuration = 60;

const DEFAULT_WINDOW_MINUTES = 5;

/**
 * Called by the scheduler every few minutes. Idempotent: a reminder is sent at most once
 * per user, prayer day and kind, guarded by the reminder_dispatches primary key.
 */
export const POST = handle(async (req: Request) => {
  const secret = envOptional("REMINDER_DISPATCH_SECRET");
  const header = req.headers.get("authorization") ?? "";
  if (!secret || header !== `Bearer ${secret}`) return errorResponse(ErrorCode.FORBIDDEN, "Not allowed.");

  const pub = envOptional("VAPID_PUBLIC_KEY");
  const priv = envOptional("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return errorResponse(ErrorCode.PUSH_NOT_CONFIGURED, "Push is not configured on this deployment.");
  webpush.setVapidDetails(envOptional("VAPID_SUBJECT") ?? "mailto:hello@example.com", pub, priv);

  const started = Date.now();
  const now = new Date();
  const windowMinutes = Number(new URL(req.url).searchParams.get("window")) || DEFAULT_WINDOW_MINUTES;

  const candidates = await db
    .select({ userId: userSettings.userId, doc: userSettings.doc })
    .from(userSettings)
    .where(sql`${userSettings.doc}->'reminders'->>'enabled' = 'true'`);

  let sent = 0;
  let pruned = 0;
  let skipped = 0;

  for (const c of candidates) {
    const parsed = SettingsDocSchema.safeParse(c.doc);
    if (!parsed.success) continue;
    const due = dueReminders(parsed.data, now, windowMinutes);
    if (due.length === 0) continue;

    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, c.userId));
    if (subs.length === 0) continue;

    for (const r of due) {
      const claimed = await db
        .insert(reminderDispatches)
        .values({ userId: c.userId, prayerDay: r.prayerDay, kind: r.kind })
        .onConflictDoNothing()
        .returning({ kind: reminderDispatches.kind });
      if (claimed.length === 0) {
        skipped++;
        continue;
      }

      const payload = JSON.stringify({ title: r.title, body: r.body, kind: r.kind, prayerDay: r.prayerDay, url: "/" });
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 600, urgency: "high" });
            sent++;
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
              pruned++;
            } else {
              console.error("push failed", status, s.endpoint.slice(0, 40));
            }
          }
        }),
      );
    }
  }

  const ms = Date.now() - started;
  console.log(`reminders: users=${candidates.length} sent=${sent} skipped=${skipped} pruned=${pruned} in ${ms}ms`);
  return NextResponse.json({ users: candidates.length, sent, skipped, pruned, ms });
});
