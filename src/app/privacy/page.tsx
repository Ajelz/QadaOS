import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Privacy" };

const SECTIONS: { label: string; body: React.ReactNode }[] = [
  { label: "What is stored", body: "The prayers you log, the debt you enter, the plans you run, your prayer-time settings, and your location as coordinates and a timezone. To sign you in: your Google account id, email address and display name. That is the whole list." },
  { label: "How it is used", body: "Religious practice is sensitive data. Yours is used only to show you your own ledger and to send the reminders you turn on. It is never sold, never shared, and never used for advertising. There is no analytics on this site." },
  { label: "Where it lives", body: "On the server, and also on your own device so the app works offline. Deleting your account removes everything from the server immediately and clears this device. You can export all of it as a file from Settings at any time." },
  {
    label: "Open source",
    body: (
      <>
        Anyone can read exactly what the code does, or run their own copy:{" "}
        <a className="font-bold underline" href="https://github.com/Ajelz/QadaOS" target="_blank" rel="noreferrer">
          github.com/Ajelz/QadaOS
        </a>
        .
      </>
    ),
  },
  { label: "Fiqh", body: "QadaOS takes no position between schools. Every option that touches a ruling is a setting with a neutral default." },
];

export default function Page() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-[480px] flex-col gap-4 px-4 pb-10 pt-[calc(env(safe-area-inset-top,0px)+2rem)]">
      <Link href="/" className="brut-sm pressable inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-[var(--r-sm)] py-2 pl-2 pr-3.5 text-[13px] font-extrabold">
        <Icon name="back" size={18} />
        Back to QadaOS
      </Link>
      <h1 className="display text-[28px]">Privacy</h1>
      {SECTIONS.map((s) => (
        <section key={s.label} className="brut rounded-[var(--r-card)] bg-paper py-3 pl-4 pr-5">
          <h2 className="mb-1 text-[11px] font-black tracking-[0.06em]">{s.label.toUpperCase()}</h2>
          <p className="text-[15px] font-semibold leading-normal">{s.body}</p>
        </section>
      ))}
    </main>
  );
}
