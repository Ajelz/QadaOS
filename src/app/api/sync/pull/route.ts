import { and, asc, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ledgerEvents } from "@/db/schema";
import { db } from "@/lib/db";
import { handle } from "@/lib/errors";
import { requireUser } from "@/lib/session";

const PAGE = 2000;

export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const since = Math.max(0, Number(new URL(req.url).searchParams.get("since") ?? 0) || 0);

  const rows = await db
    .select({
      id: ledgerEvents.id,
      type: ledgerEvents.type,
      occurredAt: ledgerEvents.occurredAt,
      tz: ledgerEvents.tz,
      deviceId: ledgerEvents.deviceId,
      payload: ledgerEvents.payload,
      serverSeq: ledgerEvents.serverSeq,
    })
    .from(ledgerEvents)
    .where(and(eq(ledgerEvents.userId, user.id), gt(ledgerEvents.serverSeq, since)))
    .orderBy(asc(ledgerEvents.serverSeq))
    .limit(PAGE + 1);

  const hasMore = rows.length > PAGE;
  const events = hasMore ? rows.slice(0, PAGE) : rows;
  const cursor = events.length ? events[events.length - 1].serverSeq : since;

  return NextResponse.json({ events, cursor, hasMore });
});
