"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { QuickLogSheet } from "@/components/sheets/QuickLogSheet";
import { ResolveSheet } from "@/components/sheets/ResolveSheet";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PrayerTile, type TileState } from "@/components/ui/PrayerTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { Sticker } from "@/components/ui/Sticker";
import { useToast } from "@/components/ui/Toast";
import { resolutionKey } from "@/domain/ledger";
import { progressFor } from "@/domain/strategy";
import { PRAYER_LABEL, type Prayer } from "@/domain/types";
import { fmtDay, fmtHijri, fmtInt, fmtTime } from "@/lib/format";
import { useLedger, useLedgerActions, useSettings } from "@/store/hooks";
import { trackedPrayers, useNow, useSchedule } from "@/store/useSchedule";

const BAR_TONE: Record<Prayer, "coral" | "violet" | "teal" | "yellow" | "sky" | "orange"> = {
  fajr: "coral",
  dhuhr: "violet",
  asr: "teal",
  maghrib: "yellow",
  isha: "sky",
  witr: "orange",
};

export function TodayScreen() {
  const now = useNow();
  const { settings, ready: settingsReady } = useSettings();
  const { state, ready } = useLedger();
  const { schedule, pending, hasWindows } = useSchedule(settings, state, now);
  const { append, revoke } = useLedgerActions();
  const toast = useToast();
  const prayers = trackedPrayers(settings);
  const tz = settings.prayer.location?.tz;

  const [resolving, setResolving] = useState<Prayer | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const initialTotal = prayers.reduce((s, p) => s + state.initial[p], 0);
  const owed = prayers.reduce((s, p) => s + Math.max(0, state.debt[p]), 0);
  const buffer = prayers.reduce((s, p) => s + Math.max(0, -state.debt[p]), 0);
  const net = owed - initialTotal;
  const firstEvent = state.events[0]?.occurredAt.slice(0, 10);

  const progress = useMemo(() => (state.activeStrategy ? progressFor(schedule.prayerDay, state, state.activeStrategy) : undefined), [state, schedule.prayerDay]);

  const current = schedule.current;
  const currentResolved = current ? state.resolutions[resolutionKey(schedule.prayerDay, current.prayer)] : undefined;

  function tileState(p: Prayer): TileState {
    const r = state.resolutions[resolutionKey(schedule.prayerDay, p)];
    if (r) return r.status === "on_time" ? "done" : r.status === "late" ? "late" : r.status === "missed" ? "missed" : "exempt";
    if (!hasWindows) return "plain";
    if (current?.prayer === p) return "now";
    if (pending.includes(p)) return "pending";
    return "upcoming";
  }

  async function prayedNow() {
    if (!current) return;
    const e = await append({ type: "daily.resolved", payload: { v: 1, prayerDay: schedule.prayerDay, prayer: current.prayer, status: "on_time" } });
    toast({ message: `${PRAYER_LABEL[current.prayer]} prayed.`, tone: "teal", action: { label: "Undo", onClick: () => revoke(e.id) } });
  }

  if (!ready || !settingsReady) {
    return (
      <>
        <Header title="Today" />
        <div className="flex flex-col gap-3">
          <Card>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-12 w-40" />
          </Card>
          <Card>
            <Skeleton className="h-4 w-20" />
            <div className="mt-3 flex flex-col gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[22px] w-full rounded-full" />
              ))}
            </div>
          </Card>
        </div>
      </>
    );
  }

  const noDebtYet = initialTotal === 0 && owed === 0;

  return (
    <>
      <Header title="Today" sub={<span>{fmtDay(schedule.prayerDay)}</span>} right={<Chip>{fmtHijri(schedule.prayerDay, settings.display.hijriOffsetDays)}</Chip>} />

      <div className="relative flex flex-col gap-3">
        <Sticker kind="star" tone="yellow" size={22} className="-right-1 top-[104px]" rotate={12} />
        <Sticker kind="square" tone="teal" size={16} className="-left-2 top-[330px]" rotate={-14} />

        {/* Card 1: debt */}
        <Card>
          {noDebtYet ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Set your starting point</CardTitle>
                <p className="mt-1 text-[12px] font-semibold text-mute">Enter how many prayers you owe and pick a plan.</p>
              </div>
              <Link href="/onboarding" className="brut pressable rounded-[var(--r-btn)] bg-yellow px-4 py-3 text-[14px] font-extrabold">
                Start
              </Link>
            </div>
          ) : (
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold text-mute">Prayers owed</div>
                <div className="display num text-[54px]">{fmtInt(owed)}</div>
                {buffer > 0 && <div className="mt-1 text-[12px] font-bold">plus {fmtInt(buffer)} in buffer past zero</div>}
              </div>
              <div className="text-right text-[12px] font-bold">
                {firstEvent && <span className="text-mute">since {fmtDay(firstEvent)}</span>}
                <Chip tone={net <= 0 ? "yellow" : "coral"} className="num mt-1.5 flex justify-end">
                  {net <= 0 ? "−" : "+"}
                  {fmtInt(Math.abs(net))} net
                </Chip>
              </div>
            </div>
          )}
        </Card>

        {/* Card 2: by prayer */}
        {!noDebtYet && (
          <Card>
            <CardTitle className="mb-2">By prayer</CardTitle>
            <div className="flex flex-col gap-2">
              {prayers.map((p) => {
                const initial = state.initial[p] + Math.max(0, state.debt[p] - state.initial[p]);
                const remaining = Math.max(0, state.debt[p]);
                const done = initial > 0 ? 1 - remaining / initial : 1;
                return (
                  <div key={p} className="grid grid-cols-[64px_1fr_56px] items-center gap-2.5 text-[13px] font-bold">
                    <span>{PRAYER_LABEL[p]}</span>
                    <ProgressBar value={done} tone={BAR_TONE[p]} label={`${PRAYER_LABEL[p]} progress`} />
                    <span className="num text-right text-[12px]">{fmtInt(remaining)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Card 3: today's prayers */}
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <CardTitle>Today</CardTitle>
            {pending.length > 0 ? (
              <Chip tone="yellow">
                {pending.length} pending
              </Chip>
            ) : !hasWindows ? (
              <span className="text-[12px] font-semibold text-mute">no prayer times set</span>
            ) : null}
          </div>
          <div className={`grid gap-1.5 ${prayers.length === 6 ? "grid-cols-6" : "grid-cols-5"}`}>
            {prayers.map((p) => {
              const w = schedule.windows.find((x) => x.prayer === p);
              const st = tileState(p);
              const interactive = st !== "now" || Boolean(currentResolved);
              return (
                <PrayerTile
                  key={p}
                  prayer={p}
                  state={st}
                  compact={prayers.length === 6}
                  time={w ? fmtTime(w.start, tz) : undefined}
                  onClick={interactive || st === "now" ? () => setResolving(p) : undefined}
                />
              );
            })}
          </div>
        </Card>

        {/* Card 4: strategy targets */}
        {state.activeStrategy && progress && (
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <CardTitle>{state.activeStrategy.name}</CardTitle>
              <Chip tone={progress.totalDone >= progress.totalTarget && progress.totalTarget > 0 ? "teal" : "paper"} className="num">
                {progress.totalDone} of {progress.totalTarget}
              </Chip>
            </div>
            {progress.targets.length === 0 ? (
              <p className="text-[12px] font-semibold text-mute">Nothing left to target. Every column this plan covers is clear.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {progress.targets.map((t) => (
                  <div key={t.ruleIndex} className="grid grid-cols-[1fr_auto] items-center gap-2 text-[13px] font-bold">
                    <span>{t.label}</span>
                    {t.count <= 12 ? (
                      <div className="flex gap-1" aria-label={`${t.done} of ${t.count}`}>
                        {Array.from({ length: t.count }, (_, i) => (
                          <i key={i} className={`h-4 w-4 rounded-[4px] border-2 border-ink ${i < t.done ? "bg-violet" : "bg-paper"}`} />
                        ))}
                      </div>
                    ) : (
                      <span className="num">
                        {t.done} / {t.count}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {!state.activeStrategy && !noDebtYet && (
          <Card tone="violet">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>No plan active</CardTitle>
                <p className="mt-1 text-[12px] font-semibold">Pick a strategy to get daily targets and a finish date.</p>
              </div>
              <Link href="/plan" className="brut pressable rounded-[var(--r-btn)] bg-paper px-4 py-3 text-[14px] font-extrabold">
                Plan
              </Link>
            </div>
          </Card>
        )}

        {/* Primary action */}
        {current && !currentResolved ? (
          <Button tone="coral" size="lg" block onClick={prayedNow}>
            Prayed {PRAYER_LABEL[current.prayer]}
          </Button>
        ) : pending.length > 0 ? (
          <Button tone="yellow" size="lg" block onClick={() => setResolving(pending[0])}>
            Resolve {PRAYER_LABEL[pending[0]]}
            {pending.length > 1 ? ` and ${pending.length - 1} more` : ""}
          </Button>
        ) : (
          <Button tone="violet" size="lg" block onClick={() => setLogOpen(true)} disabled={noDebtYet}>
            Log qada
          </Button>
        )}
        {(current && !currentResolved) || pending.length > 0 ? (
          <Button block onClick={() => setLogOpen(true)} disabled={noDebtYet}>
            Log qada
          </Button>
        ) : null}
      </div>

      <ResolveSheet
        target={resolving ? { prayer: resolving, prayerDay: schedule.prayerDay } : null}
        existing={resolving ? state.resolutions[resolutionKey(schedule.prayerDay, resolving)] : undefined}
        onClose={() => setResolving(null)}
      />
      <QuickLogSheet open={logOpen} onClose={() => setLogOpen(false)} prayers={prayers} today={schedule.prayerDay} defaultPrayer={progress?.targets.find((t) => t.done < t.count)?.prayer} />
    </>
  );
}
