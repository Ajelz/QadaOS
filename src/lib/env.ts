import { z } from "zod";

/**
 * Server-side environment. Read lazily so build tooling (drizzle-kit, better-auth CLI)
 * can import modules without every variable present.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().min(1).default("mailto:hello@example.com"),
  REMINDER_DISPATCH_SECRET: z.string().min(16),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}

/** Non-throwing access for optional features (e.g. push on a self-host without VAPID keys). */
export function envOptional<K extends keyof Env>(key: K): Env[K] | undefined {
  return process.env[key] as Env[K] | undefined;
}
