"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { QuickLogSheet } from "@/components/sheets/QuickLogSheet";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import type { LedgerEvent } from "@/domain/ledger";
import { localDateString } from "@/domain/prayerDay";
import { PRAYER_LABEL, type Prayer } from "@/domain/types";
import { fmtDay, fmtInt, fmtTime } from "@/lib/format";
import { useLedger, useLedgerActions, useSettings } from "@/store/hooks";
import { trackedPrayers, useNow, useSchedule } from "@/store/useSchedule";

const TONE: Record<Prayer, "coral" | "violet" | "teal" | "yellow" | "sky" | "grey"> = {
  fajr: "coral",
  dhuhr: "violet",
  asr: "teal",
  maghrib: "yellow",
  isha: "sky",
  witr: "grey",
};

function describe(e: LedgerEvent): { title: string; prayer?: Prayer; detail?: string } {
  switch (e.type) {
    case "qada.logged":
      return { title: `${fmtInt(e.payload.count)} ${PRAYER_LABEL[e.payload.prayer]} qada`, prayer: e.payload.prayer };
    case "daily.resolved": {
      const s = { on_time: "prayed on time", late: "prayed late", missed: "missed", exempt: "exempt" }[e.payload.status];
      return { title: `${PRAYER_LABEL[e.payload.prayer]} ${s}`, prayer: e.payload.prayer, detail: fmtDay(e.payload.prayerDay) };
    }
    case "debt.set_initial":
      return { title: `Starting debt: ${fmtInt(e.payload.count)} ${PRAYER_LABEL[e.payload.prayer]}`, prayer: e.payload.prayer };
    case "debt.adjust":
      return { title: `${e.payload.delta > 0 ? "+" : "−"}${fmtInt(Math.abs(e.payload.delta))} ${PRAYER_LABEL[e.payload.prayer]} adjustment`, prayer: e.payload.prayer, detail: e.payload.note };
    case "strategy.started":
      return { title: `Started plan "${e.payload.name}"` };
    case "strategy.stopped":
      return { title: "Stopped plan" };
    case "event.revoked":
      return { title: "Undo" };
  }
}

export function LogScreen() {
  const now = useNow();
  const { settings } = useSettings();
  const { state, ready } = useLedger();
  const { schedule } = useSchedule(settings, state, now);
  const { append, revoke } = useLedgerActions();
  const toast = useToast();
  const prayers = trackedPrayers(settings);
  const [logOpen, setLogOpen] = useState(false);
  const [preset, setPreset] = useState<Prayer | undefined>();

  const groups = useMemo(() => {
    const byDay = new Map<string, LedgerEvent[]>();
    for (const e of [...state.events].reverse()) {
      const day = e.type === "qada.logged" ? e.payload.prayerDay : e.type === "daily.resolved" ? e.payload.prayerDay : localDateString(new Date(e.occurredAt), e.tz);
      (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(e);
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [state.events]);

  async function quick(p: Prayer, count: number) {
    const e = await append({ type: "qada.logged", payload: { v: 1, prayer: p, count, prayerDay: schedule.prayerDay } });
    toast({ message: `Logged ${count} ${PRAYER_LABEL[p]}.`, tone: "teal", action: { label: "Undo", onClick: () => revoke(e.id) } });
  }

  async function undo(e: LedgerEvent) {
    await revoke(e.id);
    toast({ message: "Undone." });
  }

  return (
    <>
      <Header title="Log" sub="Every change, newest first" />

      <Card tone="violet" className="mb-3">
        <CardTitle className="mb-2">Quick log</CardTitle>
        <div className="flex flex-col gap-2">
          {prayers.map((p) => (
            <div key={p} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
              <span className="text-[13px] font-bold">{PRAYER_LABEL[p]}</span>
              <Button size="sm" onClick={() => quick(p, 1)}>
                +1
              </Button>
              <Button size="sm" onClick={() => quick(p, 5)}>
                +5
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setPreset(p);
                  setLogOpen(true);
                }}
              >
                +N
              </Button>
            </div>
          ))}
        </div>
        <Button
          block
          className="mt-3"
          onClick={() => {
            setPreset(undefined);
            setLogOpen(true);
          }}
        >
          Backdate or log a full day
        </Button>
      </Card>

      {!ready ? null : groups.length === 0 ? (
        <Card>
          <CardTitle>Nothing logged yet</CardTitle>
          <p className="mt-1 text-[12px] font-semibold text-mute">Your first entry will appear here.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(([day, events]) => (
            <section key={day}>
              <h2 className="mb-1.5 px-1 text-[12px] font-extrabold text-mute">{fmtDay(day)}</h2>
              <Card className="px-0 py-0">
                {events.map((e, i) => {
                  const d = describe(e);
                  return (
                    <div key={e.id} className={`flex items-center gap-3 px-3.5 py-2.5 ${i > 0 ? "border-t-2 border-ink" : ""}`}>
                      {d.prayer ? <Chip tone={TONE[d.prayer]} className="w-[74px] justify-center">{PRAYER_LABEL[d.prayer]}</Chip> : <Chip tone="grey" className="w-[74px] justify-center">plan</Chip>}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold">{d.title}</div>
                        <div className="text-[11px] font-semibold text-mute">
                          {fmtTime(new Date(e.occurredAt), settings.prayer.location?.tz)}
                          {d.detail ? ` · ${d.detail}` : ""}
                        </div>
                      </div>
                      {e.type !== "event.revoked" && (
                        <button type="button" onClick={() => undo(e)} className="brut-sm pressable rounded-[8px] px-2.5 py-1.5 text-[12px] font-extrabold" aria-label={`Undo ${d.title}`}>
                          Undo
                        </button>
                      )}
                    </div>
                  );
                })}
              </Card>
            </section>
          ))}
        </div>
      )}

      <QuickLogSheet open={logOpen} onClose={() => setLogOpen(false)} prayers={prayers} today={schedule.prayerDay} defaultPrayer={preset} />
    </>
  );
}
