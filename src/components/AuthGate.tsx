"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/auth-client";
import { useLedger, useSettings } from "@/store/hooks";
import { syncManager } from "@/store/syncManager";

/**
 * Local-first gate. The ledger renders from IndexedDB immediately. We only send someone
 * to sign-in when we are online and the server says there is no session; offline, a
 * device that already holds a ledger keeps working.
 *
 * NEXT_PUBLIC_AUTH_OPTIONAL=true disables the redirect for local development and e2e
 * runs that have no Google credentials. Never set it in production.
 */
export function AuthGate({ children, requireOnboarding = true }: { children: ReactNode; requireOnboarding?: boolean }) {
  const { data: session, isPending } = useSession();
  const { settings, ready: settingsReady } = useSettings();
  const { state, ready: ledgerReady } = useLedger();
  const router = useRouter();
  const path = usePathname();
  const optional = process.env.NEXT_PUBLIC_AUTH_OPTIONAL === "true";

  useEffect(() => {
    if (optional) return;
    if (isPending) return;
    if (!session && typeof navigator !== "undefined" && navigator.onLine) router.replace(`/sign-in?next=${encodeURIComponent(path)}`);
  }, [session, isPending, router, path, optional]);

  useEffect(() => {
    if (session || optional) {
      syncManager.start();
      navigator.storage?.persist?.().catch(() => undefined);
    }
  }, [session, optional]);

  useEffect(() => {
    if (!requireOnboarding || !settingsReady || !ledgerReady) return;
    const hasDebt = Object.values(state.initial).some((n) => n > 0);
    if (!settings.onboarded && !hasDebt && path !== "/onboarding") router.replace("/onboarding");
  }, [requireOnboarding, settingsReady, ledgerReady, settings.onboarded, state.initial, path, router]);

  return <>{children}</>;
}
