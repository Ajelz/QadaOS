"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { PRAYER_LABEL, type PerPrayer, type Prayer, type PrayerDay } from "@/domain/types";
import { fmtDay, fmtInt } from "@/lib/format";
import { useLedgerActions } from "@/store/hooks";

interface Props {
  open: boolean;
  onClose: () => void;
  prayers: Prayer[];
  defaultPrayer?: Prayer;
  today: PrayerDay;
  /** Current debt per prayer, for the "this goes into buffer" note. */
  owed?: PerPrayer<number>;
}

const PRESETS = [1, 5, 10, 25];

/** The sheet unmounts its form when closed, so every open starts from a fresh draft. */
export function QuickLogSheet(props: Props) {
  if (!props.open) return null;
  return <QuickLogForm {...props} />;
}

function QuickLogForm({ open, onClose, prayers, defaultPrayer, today, owed }: Props) {
  const { append, revoke } = useLedgerActions();
  const toast = useToast();
  const [prayer, setPrayer] = useState<Prayer>(defaultPrayer ?? prayers[0]);
  const [text, setText] = useState("1");
  const [day, setDay] = useState<PrayerDay>(today);

  const count = Math.min(999, Math.max(0, Math.trunc(Number(text)) || 0));
  const setCount = (n: number) => setText(String(Math.min(999, Math.max(1, n))));
  const backdated = day !== today;
  const occurredAt = backdated ? `${day}T12:00:00.000Z` : undefined;
  const when = backdated ? ` for ${fmtDay(day)}` : "";
  const remaining = owed ? Math.max(0, owed[prayer]) : undefined;
  const intoBuffer = remaining !== undefined && count > remaining ? count - remaining : 0;

  async function log() {
    if (count < 1) return;
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
        <Button tone="coral" size="lg" block onClick={log} disabled={count < 1}>
          {count < 1 ? "Enter how many" : `Log ${count} ${PRAYER_LABEL[prayer]}`}
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
                className={`pressable flex min-h-[48px] min-w-0 items-center justify-center gap-1 rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink text-[15px] font-black ${on ? "bg-violet" : "bg-paper"}`}
                style={{ boxShadow: on ? "none" : "var(--shadow-sm)", transform: on ? "translate(2px, 2px)" : undefined }}
              >
                {on && <Icon name="check" size={14} strokeWidth={3.5} />}
                {PRAYER_LABEL[p]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mb-4">
        <label htmlFor="quicklog-count" className="mb-1.5 block text-[13px] font-black">
          How many
        </label>
        <div className="flex items-stretch gap-2">
          <Button aria-label="One fewer" onClick={() => setCount(count - 1)} disabled={count <= 1} className="w-14 shrink-0 px-0">
            <Icon name="minus" size={22} strokeWidth={3.5} />
          </Button>
          <input id="quicklog-count" inputMode="numeric" pattern="[0-9]*" value={text} onChange={(e) => setText(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} onFocus={(e) => e.target.select()} className="display num min-w-0 flex-1 bg-cream text-center !text-[28px]" style={{ boxShadow: "none" }} />
          <Button aria-label="One more" onClick={() => setCount(count + 1)} className="w-14 shrink-0 px-0">
            <Icon name="plus" size={22} strokeWidth={3.5} />
          </Button>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2" role="group" aria-label="Common amounts">
          {PRESETS.map((n) => (
            <Button key={n} size="sm" variant={count === n ? "flat" : "raised"} aria-pressed={count === n} aria-label={`Set to ${n}`} onClick={() => setCount(n)}>
              {n}
            </Button>
          ))}
        </div>
        {intoBuffer > 0 && (
          <p role="status" className="mt-2 text-[13px] font-bold">
            You owe {fmtInt(remaining ?? 0)} {PRAYER_LABEL[prayer]}. Logging {fmtInt(count)} puts {fmtInt(intoBuffer)} into your buffer, which is fine.
          </p>
        )}
      </div>

      <label className="mb-4 flex flex-col gap-1.5">
        <span className="text-[13px] font-black">Prayed on</span>
        <input id="quicklog-day" type="date" value={day} max={today} onChange={(e) => e.target.value && e.target.value <= today && setDay(e.target.value)} className="w-full" />
        <span className="text-[13px] font-semibold text-mute">{backdated ? `This entry will be added to ${fmtDay(day)}.` : "Change the date to add qada you did on an earlier day."}</span>
      </label>

      <Button block variant="flat" onClick={logFullDay}>
        Make up a whole day instead (one of each)
      </Button>
    </Sheet>
  );
}
