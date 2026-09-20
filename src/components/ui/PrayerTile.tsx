"use client";

import { PRAYER_LABEL, type Prayer } from "@/domain/types";
import { Icon } from "./Icon";

export type TileState = "done" | "late" | "pending" | "now" | "upcoming" | "missed" | "exempt" | "plain";

const STATE: Record<TileState, { cls: string; sub: string; onColor: boolean }> = {
  done: { cls: "bg-teal", sub: "prayed", onColor: true },
  late: { cls: "bg-sky", sub: "late", onColor: true },
  pending: { cls: "bg-yellow", sub: "resolve", onColor: true },
  now: { cls: "bg-coral", sub: "now", onColor: true },
  upcoming: { cls: "bg-paper", sub: "", onColor: false },
  missed: { cls: "bg-paper hatch", sub: "missed", onColor: false },
  exempt: { cls: "bg-grey", sub: "exempt", onColor: true },
  plain: { cls: "bg-paper", sub: "", onColor: false },
};

/** Only Maghrib is too wide for a narrow tile. */
const SHORT: Partial<Record<Prayer, string>> = { maghrib: "Magh." };

export function PrayerTile({ prayer, state, time, onClick, dense = false }: { prayer: Prayer; state: TileState; time?: string; onClick?: () => void; dense?: boolean }) {
  const s = STATE[state];
  const Tag = onClick ? "button" : "div";
  const sub = state === "upcoming" ? (time ?? "") : s.sub;
  const short = SHORT[prayer];
  // Below the breakpoint the long name does not fit its tile, so the short form shows instead.
  // Full literal class names: Tailwind only generates classes it can see written out.
  const longCls = dense ? "max-[479px]:hidden" : "max-[419px]:hidden";
  const shortCls = dense ? "min-[480px]:hidden" : "min-[420px]:hidden";
  const description = state === "plain" ? "not answered yet" : state === "upcoming" ? `upcoming${time ? ` at ${time}` : ""}` : state === "pending" ? "pending, needs an answer" : s.sub;

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={`${PRAYER_LABEL[prayer]}, ${description}`}
      className={`flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[var(--r-btn)] border-[length:var(--bw)] border-ink px-0.5 py-1.5 text-center ${s.cls} ${onClick ? "pressable" : ""}`}
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <span className="whitespace-nowrap text-[13px] font-black leading-none tracking-[-0.01em]">
        {short ? (
          <>
            <span className={longCls}>{PRAYER_LABEL[prayer]}</span>
            <span className={shortCls}>{short}</span>
          </>
        ) : (
          PRAYER_LABEL[prayer]
        )}
      </span>
      {state === "plain" ? (
        <span className="mt-0.5 grid h-[18px] w-[18px] place-items-center rounded-[4px] border-2 border-ink bg-paper" aria-hidden />
      ) : state === "done" || state === "late" ? (
        <span className="flex items-center gap-0.5 whitespace-nowrap text-[11px] font-bold leading-none text-ink">
          <Icon name="check" size={11} strokeWidth={3.5} />
          {sub}
        </span>
      ) : (
        <span className={`num whitespace-nowrap text-[11px] font-bold leading-none ${s.onColor || state === "missed" ? "text-ink" : "text-mute"}`}>{sub || " "}</span>
      )}
    </Tag>
  );
}
