import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

export default function Page() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-[560px] flex-col gap-4 px-4 py-8 safe-top">
      <Link href="/" className="brut-sm pressable inline-flex w-fit items-center rounded-[10px] px-3 py-2 text-[13px] font-extrabold">
        ← Back
      </Link>
      <h1 className="display text-[34px]">Privacy</h1>
      <div className="brut flex flex-col gap-3 rounded-[14px] bg-paper px-4 py-4 text-[14px] font-semibold leading-relaxed">
        <p>QadaOS stores the prayers you log, the debt you enter, the plans you run, your prayer-time settings and your location as coordinates and a timezone. It stores your Google account id, email address and display name to sign you in. That is the whole list.</p>
        <p>Religious practice is sensitive data. It is used only to show you your own ledger and to send the reminders you turn on. It is never sold, shared, or used for advertising or analytics. There is no analytics on this site.</p>
        <p>Your ledger also lives on your own device so the app works offline. Deleting your account removes everything from the server immediately and clears this device. You can export all of it as a file at any time from Settings.</p>
        <p>
          The code is open source. Anyone can read exactly what it does, or run their own copy:{" "}
          <a className="underline" href="https://github.com/Ajelz/QadaOS" target="_blank" rel="noreferrer">
            github.com/Ajelz/QadaOS
          </a>
          .
        </p>
        <p>QadaOS takes no position on questions of fiqh. Every option that touches a school&apos;s ruling is a setting with a neutral default.</p>
      </div>
    </main>
  );
}
