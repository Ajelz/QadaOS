import type { Metadata } from "next";
import Link from "next/link";
import { SignInButtons } from "@/components/SignInButtons";
import { Sticker } from "@/components/ui/Sticker";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-[420px] flex-col px-4 pb-10 pt-[calc(env(safe-area-inset-top,0px)+2.5rem)]">
      <div className="my-auto flex flex-col gap-6">
        <div>
          {/* Stickers hang off the wordmark itself, so they follow it at every width. */}
          <div className="relative inline-block">
            <Sticker
              kind="star"
              tone="yellow"
              size={32}
              className="-right-5 -top-4"
              rotate={12}
            />
            <Sticker
              kind="square"
              tone="teal"
              size={18}
              className="-bottom-2 -left-3"
              rotate={-12}
            />
            <div className="brut rounded-[var(--r-card)] bg-coral px-4 py-3">
              <h1 className="display text-[44px]">QadaOS</h1>
            </div>
          </div>
          <p className="mt-5 text-[15px] font-extrabold leading-snug min-[360px]:text-[17px]">
            Missed prayers add up. QadaOS keeps one honest ledger of what you
            owe, what you make up, and what you miss today, with a catch-up plan
            you can change whenever you like.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="What you get">
            <li className="chip bg-paper">Works offline</li>
            <li className="chip bg-paper">No ads, no sharing</li>
            <li className="chip bg-paper">No streaks, no guilt</li>
            <li className="chip bg-paper">Free and open source</li>
          </ul>
        </div>

        <div>
          <SignInButtons />
          <p className="mt-3 text-center text-[13px] font-semibold text-mute">
            Setup takes about two minutes: where you pray, how many you owe, and
            a plan. Signing in again on a new device restores everything.
          </p>
        </div>

        <p className="text-[13px] font-semibold text-mute">
          Your account is your Google account. Your prayer data is used only to
          run your ledger, and you can export or delete it at any time.{" "}
          <Link href="/privacy" className="font-bold text-ink underline">
            Privacy
          </Link>
          {" · "}
          <a
            href="https://github.com/Ajelz/QadaOS"
            className="font-bold text-ink underline"
            target="_blank"
            rel="noreferrer"
          >
            Source
          </a>
        </p>
      </div>
    </main>
  );
}
