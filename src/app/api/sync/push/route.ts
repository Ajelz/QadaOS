import { and, count, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ledgerEvents } from "@/db/schema";
import { PushBodySchema } from "@/domain/schemas";
import { db } from "@/lib/db";
import { ApiError, ErrorCode, handle } from "@/lib/errors";
import { requireUser } from "@/lib/session";

/** Hard cap per user; well above any human ledger, low enough to stop floods. */
const EVENT_CAP = 1_000_000;

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json().catch(() => null);
  const parsed = PushBodySchema.safeParse(json);
  if (!parsed.success) throw new ApiError(ErrorCode.INVALID_BODY, "That batch of changes is not valid.", parsed.error.flatten());

  const [{ n }] = await db.select({ n: count() }).from(ledgerEvents).where(eq(ledgerEvents.userId, user.id));
  if (n + parsed.data.events.length > EVENT_CAP) throw new ApiError(ErrorCode.EVENT_CAP_REACHED, "This account has reached its event limit.");

  const rows = parsed.data.events.map((e) => ({
    id: e.id,
    userId: user.id,
    type: e.type,
    occurredAt: e.occurredAt,
    tz: e.tz,
    deviceId: e.deviceId,
    payload: e.payload,
  }));

  // Set-union semantics: an id we already hold is silently kept as it was.
  await db.insert(ledgerEvents).values(rows).onConflictDoNothing({ target: ledgerEvents.id });

  const ids = rows.map((r) => r.id);
  const stored = await db
    .select({ id: ledgerEvents.id, serverSeq: ledgerEvents.serverSeq })
    .from(ledgerEvents)
    .where(and(eq(ledgerEvents.userId, user.id), inArray(ledgerEvents.id, ids)));

  return NextResponse.json({ accepted: stored });
});
