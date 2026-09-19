import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { user as userTable } from "@/db/schema";
import { db } from "@/lib/db";
import { handle } from "@/lib/errors";
import { requireUser } from "@/lib/session";

/** Total, immediate deletion. Every app table cascades from `user`. */
export const DELETE = handle(async () => {
  const user = await requireUser();
  await db.delete(userTable).where(eq(userTable.id, user.id));
  return NextResponse.json({ deleted: true });
});
