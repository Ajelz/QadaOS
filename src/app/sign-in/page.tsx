import type { Metadata } from "next";
import Link from "next/link";
import { SignInButtons } from "@/components/SignInButtons";
import { Sticker } from "@/components/ui/Sticker";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-[480px] flex-col justify-center gap-6 px-4 py-10 safe-top">
      <div className="relative">
        <Sticker kind="star" tone="yellow" size={30} className="-right-1 -top-4" rotate={12} />
        <Sticker kind="square" tone="teal" size={18} className="left-2 -bottom-6" rotate={-12} />
        <div className="brut inline-block rounded-[18px] bg-coral px-4 py-3">
          <h1 className="display text-[44px]">QadaOS</h1>
        </div>
        <p className="mt-4 max-w-[34ch] text-[16px] font-bold leading-snug">Track the prayers you owe, the ones you pray today, and a plan to close the gap. Switch plans as often as you like. The math never breaks.</p>
      </div>

      <SignInButtons />

      <p className="text-[12px] font-semibold text-mute">
        Your data is stored to run the app and nothing else. <Link href="/privacy" className="underline">Privacy</Link>. Open source on{" "}
        <a href="https://github.com/Ajelz/QadaOS" className="underline" target="_blank" rel="noreferrer">
          GitHub
        </a>
        .
      </p>
    </main>
  );
}
