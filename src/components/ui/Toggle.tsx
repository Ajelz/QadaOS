"use client";

import { Icon } from "./Icon";

/** Chunky switch. Off is a grey track with the knob left; on is teal with a check in the knob. */
export function Toggle({ on, onChange, label, disabled = false }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-11 w-[72px] shrink-0 rounded-full border-[length:var(--bw)] border-ink ${on ? "bg-teal" : "bg-grey"} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <span
        className={`absolute top-1/2 grid h-[30px] w-[30px] -translate-y-1/2 place-items-center rounded-full border-[length:var(--bw)] border-ink bg-paper ${on ? "right-[4px]" : "left-[4px]"}`}
      >
        {on && <Icon name="check" size={14} strokeWidth={3.5} />}
      </span>
    </button>
  );
}
