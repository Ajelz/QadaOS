import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import * as schema from "@/db/schema";
import { db } from "./db";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const rpID = new URL(baseURL).hostname;

/**
 * Google is the only sign-up path. Passkeys are an upgrade for an existing account.
 * Email/password is deliberately disabled (spec Decision 4).
 */
export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      prompt: "select_account",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 90, // 90 days: a phone app should stay signed in
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  plugins: [
    passkey({
      rpID,
      rpName: "QadaOS",
      origin: baseURL,
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
