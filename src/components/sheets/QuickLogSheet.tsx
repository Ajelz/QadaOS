"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { PRAYER_LABEL, type Prayer, type PrayerDay } from "@/domain/types";
import { useLedgerActions } from "@/store/hooks";

interface Props {
  open: boolean;
  onClose: () => void;
  prayers: Prayer[];
  defaultPrayer?: Prayer;
  today: PrayerDay;
}

/** The sheet unmounts its form when closed, so every open starts from a fresh draft. */
export function QuickLogSheet(props: Props) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Log qada">
      <QuickLogForm {...props} />
    </Sheet>
  );
}

function QuickLogForm({ onClose, prayers, defaultPrayer, today }: Props) {
  const { append, revoke } = useLedgerActions();
  const toast = useToast();
  const [prayer, setPrayer] = useState<Prayer>(defaultPrayer ?? prayers[0]);
  const [count, setCount] = useState(1);
  const [day, setDay] = useState<PrayerDay>(today);

  const occurredAt = day === today ? undefined : `${day}T12:00:00.000Z`;

  async function log() {
    const e = await append({ type: "qada.logged", payload: { v: 1, prayer, count, prayerDay: day }, occurredAt });
    onClose();
    toast({ message: `Logged ${count} ${PRAYER_LABEL[prayer]}.`, tone: "teal", action: { label: "Undo", onClick: () => revoke(e.id) } });
  }

  async function logFullDay() {
    const ids: string[] = [];
    for (const p of prayers) {
      const e = await append({ type: "qada.logged", payload: { v: 1, prayer: p, count: 1, prayerDay: day }, occurredAt });
      ids.push(e.id);
    }
    onClose();
    toast({
      message: `Logged one full day (${prayers.length} prayers).`,
      tone: "teal",
      action: {
        label: "Undo",
        onClick: async () => {
          for (const id of ids) await revoke(id);
        },
      },
    });
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {prayers.map((p) => (
          <button key={p} type="button" onClick={() => setPrayer(p)} className="pressable">
            <Chip tone={p === prayer ? "violet" : "paper"} className="px-3 py-2 text-[13px]">
              {PRAYER_LABEL[p]}
            </Chip>
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Button aria-label="Fewer" onClick={() => setCount((c) => Math.max(1, c - 1))} className="w-14">
          −
        </Button>
        <div className="brut-flat flex-1 rounded-[var(--r-btn)] py-2 text-center">
          <div className="display num text-[34px]">{count}</div>
        </div>
        <Button aria-label="More" onClick={() => setCount((c) => Math.min(999, c + 1))} className="w-14">
          +
        </Button>
        <Button onClick={() => setCount((c) => Math.min(999, c + 5))} className="w-14">
          +5
        </Button>
      </div>

      <label className="mb-3 flex items-center justify-between gap-3 text-[13px] font-bold">
        <span>Day</span>
        <input
          id="quicklog-day"
          type="date"
          value={day}
          max={today}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          className="brut-sm rounded-[8px] px-2 py-1.5 text-[13px] font-bold"
        />
      </label>

      <Button tone="violet" size="lg" block onClick={log}>
        Log {count} {PRAYER_LABEL[prayer]}
      </Button>
      <Button block className="mt-2" onClick={logFullDay}>
        Log a full missed day
      </Button>
    </>
  );
}
