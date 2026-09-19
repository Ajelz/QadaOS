"use client";

import { PRAYER_LABEL, type Prayer } from "@/domain/types";

export type TileState = "done" | "late" | "pending" | "now" | "upcoming" | "missed" | "exempt" | "plain";

const STATE: Record<TileState, { cls: string; badge?: string; sub: string }> = {
  done: { cls: "bg-teal", badge: "✓", sub: "prayed" },
  late: { cls: "bg-sky", badge: "✓", sub: "late" },
  pending: { cls: "bg-yellow", sub: "resolve" },
  now: { cls: "bg-coral", sub: "now" },
  upcoming: { cls: "bg-paper text-mute", sub: "" },
  missed: { cls: "bg-paper border-dashed", badge: "–", sub: "missed" },
  exempt: { cls: "bg-grey", sub: "exempt" },
  plain: { cls: "bg-paper", sub: "" },
};

export function PrayerTile({
  prayer,
  state,
  time,
  onClick,
  compact = false,
}: {
  prayer: Prayer;
  state: TileState;
  time?: string;
  onClick?: () => void;
  compact?: boolean;
}) {
  const s = STATE[state];
  const interactive = Boolean(onClick);
  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={onClick}
      aria-label={`${PRAYER_LABEL[prayer]}: ${s.sub || state}`}
      className={`relative rounded-[var(--r-tile)] border-[2.5px] border-ink text-center font-extrabold ${s.cls} ${compact ? "px-1 py-1.5 text-[11px]" : "px-1 pb-1.5 pt-2 text-[12px]"} ${interactive ? "pressable cursor-pointer" : ""}`}
      style={{ boxShadow: "3px 3px 0 var(--ink)" }}
    >
      {PRAYER_LABEL[prayer]}
      {!compact && <small className="mt-0.5 block text-[10px] font-semibold text-mute">{state === "upcoming" || state === "plain" ? time ?? "" : s.sub}</small>}
      {s.badge && (
        <span className="absolute -right-1.5 -top-2 grid h-5 w-5 place-items-center rounded-full border-2 border-cream bg-ink text-[11px] text-cream">{s.badge}</span>
      )}
    </Tag>
  );
}
