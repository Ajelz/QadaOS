import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./ui/Icon";

/**
 * Screen header. The optional sticker sits right after the title, in the cream, where the
 * height never changes. Accessories on the right all share one depth (small shadow).
 */
export function Header({ title, right, sub, sticker, settings = true }: { title: string; sub?: ReactNode; right?: ReactNode; sticker?: ReactNode; settings?: boolean }) {
  return (
    <header className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="display text-[28px]">{title}</h1>
          {sticker}
        </div>
        {sub && <div className="mt-1 text-[13px] font-semibold text-mute">{sub}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        {settings && (
          <Link href="/settings" aria-label="Settings" className="brut-sm pressable grid h-11 w-11 place-items-center rounded-[var(--r-sm)] min-[900px]:hidden">
            <Icon name="gear" />
          </Link>
        )}
      </div>
    </header>
  );
}
