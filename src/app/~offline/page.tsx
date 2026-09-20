import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";

export const metadata: Metadata = { title: "Offline" };

export default function Page() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-[480px] flex-col px-4 pb-10 pt-[calc(env(safe-area-inset-top,0px)+2.5rem)]">
      <div className="my-auto flex flex-col gap-4">
        <div className="brut rounded-[var(--r-card)] bg-ink px-4 py-3 text-cream">
          <h1 className="display text-[28px]">You are offline</h1>
        </div>
        <p className="text-[15px] font-bold">
          This page was not saved for offline use, but your ledger is. Go back
          to Today and keep logging. Everything syncs when you reconnect.
        </p>
        <Link
          href="/"
          className={buttonClass({ tone: "coral", size: "lg", block: true })}
        >
          Back to Today
        </Link>
        <div aria-hidden className="mt-2 flex justify-center">
          <Sticker kind="squiggle" tone="teal" size={20} inline />
        </div>
      </div>
    </main>
  );
}
