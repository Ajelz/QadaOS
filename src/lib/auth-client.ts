"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [passkeyClient()],
});

export const { useSession, signOut } = authClient;

export function signInWithGoogle(callbackURL = "/") {
  return authClient.signIn.social({ provider: "google", callbackURL });
}

export function signInWithPasskey(callbackURL = "/") {
  return authClient.signIn.passkey({ fetchOptions: { onSuccess: () => window.location.assign(callbackURL) } });
}

export function addPasskey(name?: string) {
  return authClient.passkey.addPasskey({ name });
}
