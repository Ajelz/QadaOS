import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pushSubscriptions } from "@/db/schema";
import { PushSubscriptionSchema } from "@/domain/schemas";
import { db } from "@/lib/db";
import { ApiError, ErrorCode, handle } from "@/lib/errors";
import { requireUser } from "@/lib/session";

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const parsed = PushSubscriptionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(ErrorCode.INVALID_BODY, "That push subscription is not valid.");
  const { endpoint, keys } = parsed.data;

  await db
    .insert(pushSubscriptions)
    .values({ userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, lastSeenAt: sql`now()` },
    });

  return NextResponse.json({ subscribed: true });
});

export const DELETE = handle(async (req: Request) => {
  const user = await requireUser();
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(ErrorCode.INVALID_BODY, "Missing endpoint.");
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, parsed.data.endpoint)));
  return NextResponse.json({ subscribed: false });
});
