"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Five destinations. "History" rather than "Log": the tab holds the record, while the act
 * of logging lives on Today and in the log sheet. Settings is a tab, not a hidden gear.
 * The route stays /log so existing links and the offline cache keep working.
 */
const TABS = [
  { href: "/", label: "Today" },
  { href: "/log", label: "History" },
  { href: "/plan", label: "Plan" },
  { href: "/stats", label: "Stats" },
  { href: "/settings", label: "Settings" },
];

function isOn(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

/** Phones: a pill docked to the bottom. 900px and wider: a rail beside the column (see AppLayout). */
export function TabBar() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 min-[900px]:hidden" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
      <div className="brut flex w-full max-w-[448px] rounded-full p-1">
        {TABS.map((t) => {
          const on = isOn(path, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`grid min-h-[48px] min-w-0 flex-1 place-items-center rounded-full border-[length:var(--bw)] text-[11px] font-black tracking-[-0.01em] min-[380px]:text-[13px] ${on ? "border-ink bg-yellow" : "border-transparent"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SideRail() {
  const path = usePathname();
  return (
    <aside className="sticky top-6 hidden h-fit w-[200px] shrink-0 flex-col gap-3 min-[900px]:flex">
      <Link href="/" className="brut w-fit rounded-[var(--r-card)] bg-coral px-3 py-2" aria-label="QadaOS, go to Today">
        <span className="display text-[28px]">QadaOS</span>
      </Link>
      <nav aria-label="Main" className="brut flex flex-col gap-1 rounded-[var(--r-card)] p-1.5">
        {TABS.map((t) => {
          const on = isOn(path, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-[48px] items-center rounded-[var(--r-sm)] border-[length:var(--bw)] px-3 text-[15px] font-black ${on ? "border-ink bg-yellow" : "border-transparent"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
