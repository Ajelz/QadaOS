import type { ReactNode } from "react";

/**
 * Screen header. The optional sticker sits right after the title, in the cream, where the
 * height never changes. Settings is a tab now, so the header carries no gear.
 */
export function Header({ title, right, sub, sticker }: { title: string; sub?: ReactNode; right?: ReactNode; sticker?: ReactNode }) {
  return (
    <header className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="display text-[28px]">{title}</h1>
          {sticker}
        </div>
        {sub && <div className="mt-1 text-[13px] font-semibold text-mute">{sub}</div>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}
