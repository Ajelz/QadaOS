import { asc, eq } from "drizzle-orm";
import { ledgerEvents, userSettings } from "@/db/schema";
import { db } from "@/lib/db";
import { handle } from "@/lib/errors";
import { requireUser } from "@/lib/session";

/** Everything the account holds, as one JSON document. */
export const GET = handle(async () => {
  const user = await requireUser();
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id));
  const events = await db
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
    .where(eq(ledgerEvents.userId, user.id))
    .orderBy(asc(ledgerEvents.serverSeq));

  const body = JSON.stringify(
    {
      format: "qadaos-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      account: { email: user.email, name: user.name },
      settings: settings?.doc ?? null,
      events,
    },
    null,
    2,
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="qadaos-export-${stamp}.json"`,
      "cache-control": "no-store",
    },
  });
});
