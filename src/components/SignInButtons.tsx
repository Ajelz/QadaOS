"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { signInWithGoogle, signInWithPasskey, useSession } from "@/lib/auth-client";

function GoogleMark() {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] border-2 border-ink bg-paper" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4.1H24v8.1h12.9c-.3 2.2-1.7 5.4-4.9 7.6l7.6 5.9c4.5-4.2 6.9-10.3 6.9-17.5z" />
        <path fill="#FBBC05" d="M10.4 28.6A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6.1z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2 1.4-4.8 2.4-8.3 2.4-6.3 0-11.7-4.1-13.6-9.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
      </svg>
    </span>
  );
}

function Inner() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [busy, setBusy] = useState<"google" | "passkey" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace(next.startsWith("/") ? next : "/");
  }, [session, router, next]);

  async function google() {
    setBusy("google");
    setError(null);
    const r = await signInWithGoogle(next);
    if (r?.error) {
      setError("Google sign-in did not finish. Check your connection and try again.");
      setBusy(null);
    }
  }

  async function passkey() {
    setBusy("passkey");
    setError(null);
    const r = await signInWithPasskey(next);
    if (r?.error) {
      setError("No passkey was found on this device. Continue with Google, then add a passkey in Settings.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button tone="coral" size="lg" block onClick={google} disabled={busy !== null || isPending}>
        <GoogleMark />
        {busy === "google" ? "Opening Google…" : "Continue with Google"}
      </Button>
      <button type="button" onClick={passkey} disabled={busy !== null || isPending} className="min-h-[44px] self-center px-2 text-[13px] font-extrabold underline disabled:text-mute">
        {busy === "passkey" ? "Waiting for your passkey…" : "Already set up a passkey? Use it"}
      </button>
      {error && (
        <p role="alert" className="rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-ink px-3 py-2 text-[13px] font-bold text-cream">
          {error}
        </p>
      )}
    </div>
  );
}

export function SignInButtons() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
