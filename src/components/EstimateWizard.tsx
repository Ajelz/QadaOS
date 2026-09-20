"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { estimateFromDates } from "@/domain/estimate";

/**
 * Two dates and an exemption give a starting estimate for each of the five daily prayers.
 * Shared by onboarding and by "Re-estimate from dates" in Settings. It never commits a
 * reversed range, and it shows the result (and what it will replace) before you use it.
 */
export function EstimateWizard({ today, useLabel, onUse, onCancel, preview }: { today: string; useLabel: string; onUse: (estimate: number) => void; onCancel: () => void; preview: (estimate: number) => ReactNode }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [exempt, setExempt] = useState(0);

  const reversed = Boolean(start && end && end < start);
  const estimate = estimateFromDates(start, end, exempt);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-black">Roughly when did prayer become obligatory for you?</span>
        <input id="w-start" type="date" className="w-full" value={start} max={today} onChange={(e) => setStart(e.target.value)} />
        <span className="text-[13px] font-semibold text-mute">Roughly is fine. The month and year matter most.</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-black">When did you begin praying regularly?</span>
        <input id="w-end" type="date" className="w-full" value={end} min={start || undefined} max={today} onChange={(e) => setEnd(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-black">Days each month with no obligation</span>
        <select className="w-full" value={exempt} onChange={(e) => setExempt(Number(e.target.value))}>
          {[0, 3, 4, 5, 6, 7, 8, 10].map((v) => (
            <option key={v} value={v}>
              {v === 0 ? "None" : `${v} days`}
            </option>
          ))}
        </select>
        <span className="text-[13px] font-semibold text-mute">For example during menstruation. Leave at none if this does not apply to you.</span>
      </label>
      {reversed && (
        <p role="alert" className="rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-ink px-3 py-2 text-[13px] font-bold text-cream">
          The second date has to come after the first.
        </p>
      )}
      {estimate !== undefined && <div className="rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-orange px-3 py-2 text-[13px] font-bold">{preview(estimate)}</div>}
      <div className="flex gap-3">
        <Button block onClick={onCancel}>
          Cancel
        </Button>
        <Button block tone="coral" disabled={estimate === undefined} onClick={() => estimate !== undefined && onUse(estimate)}>
          {useLabel}
        </Button>
      </div>
    </div>
  );
}
