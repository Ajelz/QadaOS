"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { PRAYER_LABEL, type Prayer, type PrayerDay } from "@/domain/types";
import { fmtDay } from "@/lib/format";
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
  if (!props.open) return null;
  return <QuickLogForm {...props} />;
}

function QuickLogForm({ open, onClose, prayers, defaultPrayer, today }: Props) {
  const { append, revoke } = useLedgerActions();
  const toast = useToast();
  const [prayer, setPrayer] = useState<Prayer>(defaultPrayer ?? prayers[0]);
  const [count, setCount] = useState(1);
  const [day, setDay] = useState<PrayerDay>(today);

  const backdated = day !== today;
  const occurredAt = backdated ? `${day}T12:00:00.000Z` : undefined;
  const when = backdated ? ` for ${fmtDay(day)}` : "";

  async function log() {
    const e = await append({ type: "qada.logged", payload: { v: 1, prayer, count, prayerDay: day }, occurredAt });
    onClose();
    toast({ message: `Logged ${count} ${PRAYER_LABEL[prayer]} qada${when}.`, tone: "teal", action: { label: "Undo", onClick: () => revoke(e.id) } });
  }

  async function logFullDay() {
    const ids: string[] = [];
    for (const p of prayers) {
      const e = await append({ type: "qada.logged", payload: { v: 1, prayer: p, count: 1, prayerDay: day }, occurredAt });
      ids.push(e.id);
    }
    onClose();
    toast({
      message: `Logged one of each prayer${when}.`,
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
    <Sheet
      open={open}
      onClose={onClose}
      title="Log qada"
      footer={
        <Button tone="coral" size="lg" block onClick={log}>
          Log {count} {PRAYER_LABEL[prayer]}
        </Button>
      }
    >
      <fieldset className="mb-4 min-w-0">
        <legend className="mb-1.5 text-[13px] font-black">Which prayer</legend>
        <div className="grid grid-cols-3 gap-2">
          {prayers.map((p) => {
            const on = p === prayer;
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => setPrayer(p)}
                className={`pressable min-h-[48px] min-w-0 rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink text-[15px] font-black ${on ? "bg-violet" : "bg-paper"}`}
                style={{ boxShadow: on ? "none" : "var(--shadow-sm)", transform: on ? "translate(2px, 2px)" : undefined }}
              >
                {PRAYER_LABEL[p]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mb-4">
        <div className="mb-1.5 text-[13px] font-black" id="quicklog-count-label">
          How many
        </div>
        <div className="flex items-stretch gap-2">
          <Button aria-label="One fewer" onClick={() => setCount((c) => Math.max(1, c - 1))} disabled={count <= 1} className="w-14 shrink-0 px-0">
            <Icon name="minus" size={22} strokeWidth={3.5} />
          </Button>
          <output aria-labelledby="quicklog-count-label" aria-live="polite" className="display num grid min-w-0 flex-1 place-items-center rounded-[var(--r-btn)] border-[length:var(--bw)] border-ink bg-cream text-[28px]">
            {count}
          </output>
          <Button aria-label="One more" onClick={() => setCount((c) => Math.min(999, c + 1))} className="w-14 shrink-0 px-0">
            <Icon name="plus" size={22} strokeWidth={3.5} />
          </Button>
          <Button aria-label="Five more" onClick={() => setCount((c) => Math.min(999, c + 5))} className="w-14 shrink-0 px-0">
            +5
          </Button>
        </div>
      </div>

      <label className="mb-4 flex flex-col gap-1.5">
        <span className="text-[13px] font-black">Prayed on</span>
        <input id="quicklog-day" type="date" value={day} max={today} onChange={(e) => e.target.value && e.target.value <= today && setDay(e.target.value)} className="w-full" />
        <span className="text-[13px] font-semibold text-mute">{backdated ? "This entry will be added to an earlier day." : "Change the date to add qada you did on an earlier day."}</span>
      </label>

      <Button block variant="flat" onClick={logFullDay}>
        Log one of each prayer instead
      </Button>
    </Sheet>
  );
}
