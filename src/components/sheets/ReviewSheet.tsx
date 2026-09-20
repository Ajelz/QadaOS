"use client";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { resolutionKey, type LedgerState } from "@/domain/ledger";
import { PRAYER_LABEL, type Prayer, type PrayerDay, type ResolutionStatus } from "@/domain/types";
import { fmtDay } from "@/lib/format";
import { useLedgerActions } from "@/store/hooks";
import { STATUS_BUTTON } from "./ResolveSheet";

const OPTIONS: { status: ResolutionStatus; label: string }[] = [
  { status: "on_time", label: "On time" },
  { status: "late", label: "Late" },
  { status: "missed", label: "Missed" },
  { status: "exempt", label: "Exempt" },
];

/**
 * The end-of-day job on one screen: every unanswered prayer with its four answers in a row.
 * One tap per prayer. Answers stay changeable until the sheet is closed, and afterwards
 * from the tile itself.
 */
export function ReviewSheet({ open, onClose, prayers, prayerDay, state }: { open: boolean; onClose: () => void; prayers: Prayer[]; prayerDay: PrayerDay; state: LedgerState }) {
  const { append, revoke } = useLedgerActions();

  async function answer(prayer: Prayer, status: ResolutionStatus) {
    const existing = state.resolutions[resolutionKey(prayerDay, prayer)];
    if (existing?.status === status) return;
    if (existing) await revoke(existing.eventId);
    await append({ type: "daily.resolved", payload: { v: 1, prayerDay, prayer, status } });
  }

  const left = prayers.filter((p) => !state.resolutions[resolutionKey(prayerDay, p)]).length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Review ${fmtDay(prayerDay)}`}
      footer={
        <Button block size="lg" tone={left === 0 ? "coral" : "paper"} onClick={onClose}>
          {left === 0 ? "Done" : `Close, ${left} left`}
        </Button>
      }
    >
      <p className="mb-3 text-[13px] font-semibold text-mute">One tap per prayer. Late still counts as prayed. Only missed adds to what you owe.</p>
      <div className="flex flex-col gap-3">
        {prayers.map((p) => {
          const current = state.resolutions[resolutionKey(prayerDay, p)]?.status;
          return (
            <fieldset key={p} className="min-w-0">
              <legend className="mb-1.5 text-[15px] font-black">{PRAYER_LABEL[p]}</legend>
              <div className="grid grid-cols-4 gap-2">
                {OPTIONS.map((o) => {
                  const on = current === o.status;
                  return (
                    <button
                      key={o.status}
                      type="button"
                      aria-pressed={on}
                      onClick={() => answer(p, o.status)}
                      className={`pressable min-h-[48px] min-w-0 rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink px-1 text-[13px] font-black leading-tight ${on ? STATUS_BUTTON[o.status] : "bg-paper"}`}
                      style={{ boxShadow: on ? "none" : "var(--shadow-sm)", transform: on ? "translate(2px, 2px)" : undefined }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </Sheet>
  );
}
