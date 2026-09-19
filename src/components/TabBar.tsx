"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today" },
  { href: "/log", label: "Log" },
  { href: "/plan", label: "Plan" },
  { href: "/stats", label: "Stats" },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
      <div className="brut flex w-full max-w-[440px] gap-1 rounded-full p-1.5">
        {TABS.map((t) => {
          const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`flex-1 rounded-full border-2 py-2.5 text-center text-[12px] font-bold ${on ? "border-ink bg-yellow" : "border-transparent"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
