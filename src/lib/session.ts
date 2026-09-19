import { headers } from "next/headers";
import { auth } from "./auth";
import { ApiError, ErrorCode } from "./errors";

/** The signed-in user for a route handler or server component, or throw 401. */
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new ApiError(ErrorCode.UNAUTHENTICATED, "Sign in to continue.");
  return session.user;
}

export async function optionalUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}
