"use client";

import { Button, type ButtonTone } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import type { Resolution } from "@/domain/ledger";
import { PRAYER_LABEL, type Prayer, type PrayerDay, type ResolutionStatus } from "@/domain/types";
import { fmtDay } from "@/lib/format";
import { useLedgerActions } from "@/store/hooks";

export const STATUS_LABEL: Record<ResolutionStatus, string> = { on_time: "prayed on time", late: "prayed late", missed: "missed", exempt: "exempt" };

/** Button fills match the tile each answer produces, so the choice and its result look alike. */
export const STATUS_TONE: Record<ResolutionStatus, ButtonTone> = { on_time: "teal", late: "sky", missed: "paper", exempt: "grey" };

/** The same fills as raw classes, for controls that are not a <Button>. Never combine with another bg-* class. */
export const STATUS_BUTTON: Record<ResolutionStatus, string> = {
  on_time: "bg-teal",
  late: "bg-sky",
  missed: "bg-paper hatch",
  exempt: "bg-grey",
};

export function ResolveSheet({ target, existing, onClose }: { target: { prayer: Prayer; prayerDay: PrayerDay } | null; existing?: Resolution; onClose: () => void }) {
  const { append, revoke } = useLedgerActions();
  const toast = useToast();

  async function resolve(status: ResolutionStatus) {
    if (!target) return;
    if (existing?.status === status) return onClose();
    if (existing) await revoke(existing.eventId);
    const e = await append({ type: "daily.resolved", payload: { v: 1, prayerDay: target.prayerDay, prayer: target.prayer, status } });
    onClose();
    toast({ message: `${PRAYER_LABEL[target.prayer]} recorded as ${STATUS_LABEL[status]}.`, tone: status === "on_time" || status === "late" ? "teal" : "paper", action: { label: "Undo", onClick: () => revoke(e.id) } });
  }

  async function clear() {
    if (!existing) return;
    await revoke(existing.eventId);
    onClose();
    toast({ message: "Answer cleared." });
  }

  const options: { status: ResolutionStatus; label: string }[] = [
    { status: "on_time", label: "Prayed on time" },
    { status: "late", label: "Prayed late" },
    { status: "missed", label: "Missed" },
    { status: "exempt", label: "Exempt" },
  ];

  return (
    <Sheet open={Boolean(target)} onClose={onClose} title={target ? `${PRAYER_LABEL[target.prayer]}, ${fmtDay(target.prayerDay)}` : ""}>
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        {options.map((o) => (
          <Button key={o.status} size="lg" tone={STATUS_TONE[o.status]} className={`${o.status === "missed" ? "hatch" : ""} ${existing?.status === o.status ? "outline outline-[3px] outline-offset-2 outline-ink" : ""}`} aria-pressed={existing?.status === o.status} onClick={() => resolve(o.status)}>
            {o.label}
          </Button>
        ))}
      </div>
      <p className="mt-4 text-[13px] font-semibold text-mute">Late still counts as prayed. Missed adds one to what you owe. Exempt is for a day with no obligation, such as during menstruation.</p>
      {existing && (
        <Button block variant="flat" className="mt-3" onClick={clear}>
          Clear this answer
        </Button>
      )}
    </Sheet>
  );
}
