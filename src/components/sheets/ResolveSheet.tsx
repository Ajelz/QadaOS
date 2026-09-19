"use client";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import type { Resolution } from "@/domain/ledger";
import { PRAYER_LABEL, type Prayer, type PrayerDay, type ResolutionStatus } from "@/domain/types";
import { fmtDay } from "@/lib/format";
import { useLedgerActions } from "@/store/hooks";

export function ResolveSheet({
  target,
  existing,
  onClose,
}: {
  target: { prayer: Prayer; prayerDay: PrayerDay } | null;
  existing?: Resolution;
  onClose: () => void;
}) {
  const { append, revoke } = useLedgerActions();
  const toast = useToast();

  async function resolve(status: ResolutionStatus) {
    if (!target) return;
    const e = await append({ type: "daily.resolved", payload: { v: 1, prayerDay: target.prayerDay, prayer: target.prayer, status } });
    onClose();
    const label = { on_time: "prayed on time", late: "prayed late", missed: "missed", exempt: "exempt" }[status];
    toast({ message: `${PRAYER_LABEL[target.prayer]} marked ${label}.`, tone: status === "missed" ? "paper" : "teal", action: { label: "Undo", onClick: () => revoke(e.id) } });
  }

  async function clear() {
    if (!existing) return;
    await revoke(existing.eventId);
    onClose();
    toast({ message: "Cleared. It is pending again." });
  }

  return (
    <Sheet open={Boolean(target)} onClose={onClose} title={target ? `${PRAYER_LABEL[target.prayer]}, ${fmtDay(target.prayerDay)}` : ""}>
      <div className="grid grid-cols-2 gap-3">
        <Button tone="teal" size="lg" onClick={() => resolve("on_time")}>
          Prayed on time
        </Button>
        <Button tone="sky" size="lg" onClick={() => resolve("late")}>
          Prayed late
        </Button>
        <Button tone="coral" size="lg" onClick={() => resolve("missed")}>
          Missed
        </Button>
        <Button tone="grey" size="lg" onClick={() => resolve("exempt")}>
          Exempt
        </Button>
      </div>
      <p className="mt-3 text-[12px] font-semibold text-mute">Missed adds one to your debt. Late counts as prayed. Exempt is for days with no obligation.</p>
      {existing && (
        <Button block className="mt-3" onClick={clear}>
          Clear this answer
        </Button>
      )}
    </Sheet>
  );
}
