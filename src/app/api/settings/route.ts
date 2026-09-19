import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { userSettings } from "@/db/schema";
import { SettingsDocSchema, SettingsPutSchema } from "@/domain/schemas";
import { db } from "@/lib/db";
import { ApiError, ErrorCode, handle } from "@/lib/errors";
import { requireUser } from "@/lib/session";

export const GET = handle(async () => {
  const user = await requireUser();
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id));
  if (!row) return NextResponse.json({ doc: SettingsDocSchema.parse({}), updatedAt: null });
  return NextResponse.json({ doc: SettingsDocSchema.parse(row.doc), updatedAt: row.updatedAt });
});

/** Last-write-wins by updatedAt: an older document never overwrites a newer one. */
export const PUT = handle(async (req: Request) => {
  const user = await requireUser();
  const parsed = SettingsPutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new ApiError(ErrorCode.INVALID_BODY, "Those settings are not valid.", parsed.error.flatten());
  const { doc, updatedAt } = parsed.data;

  await db
    .insert(userSettings)
    .values({ userId: user.id, doc, updatedAt })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { doc: sql`excluded.doc`, updatedAt: sql`excluded.updated_at` },
      setWhere: sql`${userSettings.updatedAt} < excluded.updated_at`,
    });

  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id));
  return NextResponse.json({ doc: SettingsDocSchema.parse(row.doc), updatedAt: row.updatedAt });
});
