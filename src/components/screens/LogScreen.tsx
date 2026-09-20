"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { QuickLogSheet } from "@/components/sheets/QuickLogSheet";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageFoot, Sticker } from "@/components/ui/Sticker";
import { useToast } from "@/components/ui/Toast";
import type { LedgerEvent } from "@/domain/ledger";
import { localDateString } from "@/domain/prayerDay";
import { PRAYER_LABEL, type Prayer } from "@/domain/types";
import { fmtDay, fmtInt, fmtTime } from "@/lib/format";
import { useLedger, useLedgerActions, useSettings } from "@/store/hooks";
import { trackedPrayers, useNow, useSchedule } from "@/store/useSchedule";

type Direction = "down" | "up" | "neutral" | "structural";

/** The rail colour says which way the entry moved the debt. Prayers themselves have no colour. */
const RAIL: Record<Direction, string> = { down: "bg-teal", up: "bg-grey", neutral: "bg-paper", structural: "bg-ink" };

function describe(e: LedgerEvent): { title: string; detail?: string; direction: Direction; structural: boolean } {
  switch (e.type) {
    case "qada.logged":
      return { title: `${fmtInt(e.payload.count)} ${PRAYER_LABEL[e.payload.prayer]} qada`, direction: "down", structural: false };
    case "daily.resolved": {
      const s = { on_time: "prayed on time", late: "prayed late", missed: "missed", exempt: "exempt" }[e.payload.status];
      return { title: `${PRAYER_LABEL[e.payload.prayer]} ${s}`, direction: e.payload.status === "missed" ? "up" : "neutral", structural: false };
    }
    case "debt.set_initial":
      return { title: `Start: ${fmtInt(e.payload.count)} ${PRAYER_LABEL[e.payload.prayer]}`, detail: "starting estimate", direction: "structural", structural: true };
    case "debt.adjust":
      return { title: `${PRAYER_LABEL[e.payload.prayer]} ${e.payload.delta > 0 ? "+" : "−"}${fmtInt(Math.abs(e.payload.delta))}`, detail: e.payload.note ? `adjustment: ${e.payload.note}` : "estimate adjusted", direction: e.payload.delta > 0 ? "up" : "down", structural: true };
    case "strategy.started":
      return { title: `Plan started: ${e.payload.name}`, direction: "structural", structural: true };
    case "strategy.stopped":
      return { title: "Plan stopped", direction: "structural", structural: true };
    case "event.revoked":
      return { title: "Undo", direction: "neutral", structural: false };
  }
}

function dayOf(e: LedgerEvent): string {
  return e.type === "qada.logged" || e.type === "daily.resolved" ? e.payload.prayerDay : localDateString(new Date(e.occurredAt), e.tz);
}

export function LogScreen() {
  const now = useNow();
  const { settings } = useSettings();
  const { state, ready } = useLedger();
  const { schedule } = useSchedule(settings, state, now);
  const { append, revoke } = useLedgerActions();
  const toast = useToast();
  const prayers = trackedPrayers(settings);
  const tz = settings.prayer.location?.tz;
  const [logOpen, setLogOpen] = useState(false);
  const [preset, setPreset] = useState<Prayer | undefined>();
  const [confirming, setConfirming] = useState<LedgerEvent | null>(null);
  const [showUndone, setShowUndone] = useState(false);
  const [padOpen, setPadOpen] = useState(false);
  // Years of entries: render a month at a time rather than the whole ledger.
  const [shownDays, setShownDays] = useState(30);

  const groups = useMemo(() => {
    const byDay = new Map<string, LedgerEvent[]>();
    for (const e of [...state.events].reverse()) {
      const day = dayOf(e);
      const list = byDay.get(day);
      if (list) list.push(e);
      else byDay.set(day, [e]);
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [state.events]);

  async function quick(p: Prayer, count: number) {
    const e = await append({ type: "qada.logged", payload: { v: 1, prayer: p, count, prayerDay: schedule.prayerDay } });
    toast({ message: `Logged ${count} ${PRAYER_LABEL[p]} qada.`, tone: "teal", action: { label: "Undo", onClick: () => revoke(e.id) } });
  }

  async function undo(e: LedgerEvent) {
    const r = await revoke(e.id);
    setConfirming(null);
    toast({ message: `Undone: ${describe(e).title}.`, action: { label: "Restore", onClick: () => revoke(r.id) } });
  }

  function requestUndo(e: LedgerEvent) {
    // Entries that reshape the whole ledger ask first; everyday entries undo in one tap.
    if (describe(e).structural) setConfirming(e);
    else void undo(e);
  }

  async function restore(revokerId: string, title: string) {
    await revoke(revokerId);
    toast({ message: `Restored: ${title}.`, tone: "teal" });
  }

  return (
    <>
      <Header title="Log" sub="Every change, newest first" sticker={<Sticker kind="squiggle" tone="violet" size={18} inline />} />

      <div className="mb-4 flex flex-col gap-2">
        <Button
          tone="coral"
          size="lg"
          block
          onClick={() => {
            setPreset(undefined);
            setLogOpen(true);
          }}
        >
          Log qada
        </Button>
        <Button block variant="flat" aria-expanded={padOpen} aria-controls="quick-pad" onClick={() => setPadOpen((v) => !v)}>
          {padOpen ? "Hide quick buttons" : "Show quick +1 and +5 buttons"}
        </Button>
        {padOpen && (
          <Card id="quick-pad">
            <CardTitle className="mb-2">Quick log for today</CardTitle>
            <div className="flex flex-col gap-2">
              {prayers.map((p) => (
                <div key={p} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                  <span className="text-[15px] font-extrabold">{PRAYER_LABEL[p]}</span>
                  <Button size="sm" className="w-[60px] px-0" aria-label={`Log 1 ${PRAYER_LABEL[p]} qada`} onClick={() => quick(p, 1)}>
                    +1
                  </Button>
                  <Button size="sm" className="w-[60px] px-0" aria-label={`Log 5 ${PRAYER_LABEL[p]} qada`} onClick={() => quick(p, 5)}>
                    +5
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {!ready ? (
        <Card aria-busy="true">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-10 w-full" />
          <Skeleton className="mt-2 h-10 w-full" />
        </Card>
      ) : groups.length === 0 ? (
        <Card tone="yellow">
          <CardTitle className="text-[17px]">Nothing logged yet</CardTitle>
          <p className="mt-1 text-[13px] font-semibold">Your first entry appears here. Everything can be undone, and anything undone can be restored.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.slice(0, shownDays).map(([day, events]) => (
            <section key={day} aria-label={fmtDay(day)}>
              <h2 className="ml-3 inline-block rounded-t-[var(--r-sm)] border-[length:var(--bw)] border-b-0 border-ink bg-ink px-2.5 py-1 text-[11px] font-black tracking-[0.04em] text-cream">{fmtDay(day).toUpperCase()}</h2>
              <Card padded={false}>
                <ul>
                  {events.map((e, i) => {
                    const d = describe(e);
                    return (
                      <li key={e.id} className={`flex items-stretch gap-3 ${i > 0 ? "border-t-[length:var(--bw)] border-ink" : ""}`}>
                        <span aria-hidden className={`w-2 shrink-0 border-r-[length:var(--bw)] border-ink ${RAIL[d.direction]}`} />
                        <div className="min-w-0 flex-1 py-2.5">
                          <div className="line-clamp-2 text-[15px] font-extrabold leading-tight">{d.title}</div>
                          <div className="mt-0.5 text-[11px] font-semibold text-mute">
                            {fmtTime(new Date(e.occurredAt), tz)}
                            {d.detail ? ` · ${d.detail}` : ""}
                            {d.direction === "down" ? " · lowers what you owe" : d.direction === "up" ? " · adds to what you owe" : ""}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center pr-2">
                          <IconButton icon="undo" label={`Undo: ${d.title}`} flat onClick={() => requestUndo(e)} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}

      {groups.length > shownDays && (
        <Button block variant="flat" className="mt-4" onClick={() => setShownDays((n) => n + 60)}>
          Show older entries ({groups.length - shownDays} more days)
        </Button>
      )}

      {state.undone.length > 0 && (
        <section className="mt-5">
          <Button block variant="flat" aria-expanded={showUndone} onClick={() => setShowUndone((v) => !v)}>
            {showUndone ? "Hide" : "Show"} {state.undone.length} undone {state.undone.length === 1 ? "entry" : "entries"}
          </Button>
          {showUndone && (
            <Card padded={false} className="mt-3">
              <ul>
                {state.undone.map((u, i) => {
                  const d = describe(u.event);
                  return (
                    <li key={u.event.id} className={`flex items-center gap-3 py-2 pl-4 pr-2 ${i > 0 ? "border-t-[length:var(--bw)] border-ink" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[15px] font-extrabold leading-tight text-mute line-through decoration-2">{d.title}</div>
                        <div className="mt-0.5 text-[11px] font-semibold text-mute">undone {fmtDay(localDateString(new Date(u.undoneAt), u.event.tz))}</div>
                      </div>
                      <IconButton icon="restore" label={`Restore: ${d.title}`} flat onClick={() => restore(u.revokerId, d.title)} />
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>
      )}

      <PageFoot>
        <Sticker kind="dot" tone="orange" size={16} inline />
        <Sticker kind="star" tone="teal" size={20} rotate={-8} inline />
      </PageFoot>

      <QuickLogSheet open={logOpen} onClose={() => setLogOpen(false)} prayers={prayers} today={schedule.prayerDay} owed={state.debt} defaultPrayer={preset} />

      <Sheet
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Undo this entry?"
        footer={
          <div className="flex gap-3">
            <Button block onClick={() => setConfirming(null)}>
              Keep it
            </Button>
            <Button block tone="rust" onClick={() => confirming && undo(confirming)}>
              Undo it
            </Button>
          </div>
        }
      >
        {confirming && (
          <>
            <p className="text-[17px] font-black leading-tight">{describe(confirming).title}</p>
            <p className="mt-2 text-[13px] font-semibold text-mute">This entry shapes your whole ledger, so your totals and projections will change. You can restore it afterwards from the undone entries at the bottom of the Log.</p>
          </>
        )}
      </Sheet>
    </>
  );
}
