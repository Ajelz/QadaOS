import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline" };

export default function Page() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-[480px] flex-col justify-center gap-4 px-4 py-10 safe-top">
      <div className="brut rounded-[14px] bg-ink px-4 py-3 text-cream">
        <h1 className="display text-[28px]">You are offline</h1>
      </div>
      <p className="text-[14px] font-bold">This page was not saved for offline use. Your ledger still is: go back to Today and keep logging. Changes sync when you reconnect.</p>
      <Link href="/" className="brut pressable inline-flex justify-center rounded-[12px] bg-yellow px-4 py-3 text-[15px] font-extrabold">
        Back to Today
      </Link>
    </main>
  );
}
