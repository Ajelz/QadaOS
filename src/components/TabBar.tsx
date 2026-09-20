"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./ui/Icon";

const TABS = [
  { href: "/", label: "Today" },
  { href: "/log", label: "Log" },
  { href: "/plan", label: "Plan" },
  { href: "/stats", label: "Stats" },
];

function isOn(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

/** Phones: a pill docked to the bottom. 900px and wider: a rail beside the column (see AppLayout). */
export function TabBar() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 min-[900px]:hidden" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
      <div className="brut flex w-full max-w-[448px] gap-1 rounded-full p-1">
        {TABS.map((t) => {
          const on = isOn(path, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`grid min-h-[48px] flex-1 place-items-center rounded-full border-[length:var(--bw)] text-[13px] font-black ${on ? "border-ink bg-yellow" : "border-transparent"}`}
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
      <Link href="/settings" aria-current={path.startsWith("/settings") ? "page" : undefined} className={`brut-sm pressable flex min-h-[48px] items-center gap-2 rounded-[var(--r-btn)] px-3 text-[15px] font-black ${path.startsWith("/settings") ? "bg-yellow" : ""}`}>
        <Icon name="gear" size={20} />
        Settings
      </Link>
    </aside>
  );
}
