"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { QuickLogSheet } from "@/components/sheets/QuickLogSheet";
import { ResolveSheet } from "@/components/sheets/ResolveSheet";
import { ReviewSheet } from "@/components/sheets/ReviewSheet";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { DebtBar } from "@/components/ui/DebtBar";
import { Icon } from "@/components/ui/Icon";
import { PrayerTile, type TileState } from "@/components/ui/PrayerTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageFoot, Sticker } from "@/components/ui/Sticker";
import { useToast } from "@/components/ui/Toast";
import { resolutionKey } from "@/domain/ledger";
import { localDateString } from "@/domain/prayerDay";
import { progressFor } from "@/domain/strategy";
import { PRAYER_LABEL, type Prayer } from "@/domain/types";
import { fmtDay, fmtHijri, fmtInt, fmtTimeShort } from "@/lib/format";
import { useLedger, useLedgerActions, useSettings } from "@/store/hooks";
import { trackedPrayers, useNow, useSchedule } from "@/store/useSchedule";

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
  const [reviewing, setReviewing] = useState<Prayer[] | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const initialTotal = prayers.reduce((s, p) => s + state.initial[p], 0);
  const owed = prayers.reduce((s, p) => s + Math.max(0, state.debt[p]), 0);
  const buffer = prayers.reduce((s, p) => s + Math.max(0, -state.debt[p]), 0);
  const net = owed - initialTotal;
  const firstEvent = state.events[0]?.occurredAt.slice(0, 10);

  const progress = useMemo(() => (state.activeStrategy ? progressFor(schedule.prayerDay, state, state.activeStrategy) : undefined), [state, schedule.prayerDay]);

  const current = schedule.current;
  const currentResolved = current ? state.resolutions[resolutionKey(schedule.prayerDay, current.prayer)] : undefined;
  const hijri = fmtHijri(schedule.prayerDay, settings.display.hijriOffsetDays);
  // Before Fajr the wall clock says tomorrow while the prayer day is still yesterday. Say so.
  const civilDay = localDateString(now, tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const beforeFajr = hasWindows && civilDay !== schedule.prayerDay;
  const minutesLeft = current ? Math.max(0, Math.round((current.end.getTime() - now.getTime()) / 60_000)) : 0;
  // Kept short for the tile; the accessible name adds the word "left".
  const leftLabel = current ? (minutesLeft >= 60 ? `${Math.floor(minutesLeft / 60)}h ${minutesLeft % 60}m` : `${minutesLeft}m left`) : undefined;

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
    toast({ message: `${PRAYER_LABEL[current.prayer]} recorded as prayed on time.`, tone: "teal", action: { label: "Undo", onClick: () => revoke(e.id) } });
  }

  if (!ready || !settingsReady) {
    return (
      <>
        <Header title="Today" />
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading your ledger">
          <Card>
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-[54px] w-44" />
          </Card>
          <Card>
            <Skeleton className="h-3.5 w-20" />
            <div className="mt-3 flex flex-col gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[22px] w-full rounded-full" />
              ))}
            </div>
          </Card>
          <Card>
            <Skeleton className="h-3.5 w-16" />
            <div className="mt-3 grid grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[52px] rounded-[var(--r-btn)]" />
              ))}
            </div>
          </Card>
          <Skeleton className="h-[56px] w-full rounded-[var(--r-btn)]" />
        </div>
      </>
    );
  }

  const noDebtYet = initialTotal === 0 && owed === 0;
  const dense = prayers.length === 6;
  const showPrayedNow = Boolean(current && !currentResolved);

  return (
    <>
      <Header
        title="Today"
        sticker={<Sticker kind="sparkle" tone="yellow" size={22} rotate={10} inline />}
        sub={
          <>
            {fmtDay(schedule.prayerDay)}
            {hijri && <span className="whitespace-nowrap"> · {hijri}</span>}
            {settings.prayer.location && (
              <>
                {" · "}
                <Link href="/settings" className="whitespace-nowrap underline">
                  {settings.prayer.location.label ?? "Prayer times"}
                </Link>
              </>
            )}
            {beforeFajr && <span className="mt-0.5 block font-bold text-ink">It is past midnight, but this prayer day runs until Fajr.</span>}
          </>
        }
      />

      <div className="flex flex-col gap-3">
        {/* 1. Debt */}
        {noDebtYet ? (
          <Card tone="coral">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-[17px]">Set your starting point</CardTitle>
                <p className="mt-1 text-[13px] font-semibold">Enter how many prayers you owe and pick a plan. It takes about two minutes.</p>
              </div>
              <Link href="/onboarding" className={buttonClass({ tone: "paper" })}>
                Start
              </Link>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex flex-col items-start gap-2 min-[360px]:flex-row min-[360px]:items-end min-[360px]:justify-between">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-mute">Prayers owed</div>
                <div className="display num text-[clamp(34px,13vw,54px)]">{fmtInt(owed)}</div>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-1 min-[360px]:items-end">
                {net !== 0 && <Chip tone={net < 0 ? "teal" : "grey"} className="num" aria-label={`Net change since you started: ${net > 0 ? "up" : net < 0 ? "down" : "no change"} ${fmtInt(Math.abs(net))}`}>
                  {net === 0 ? "" : net < 0 ? "−" : "+"}
                  {fmtInt(Math.abs(net))} {net < 0 ? "fewer" : "more"}
                </Chip>}
                {firstEvent && <span className="whitespace-nowrap text-[11px] font-semibold text-mute">{net !== 0 ? "than when you started, " : "started "}{fmtDay(firstEvent)}</span>}
              </div>
            </div>
            {buffer > 0 && <p className="mt-2 text-[13px] font-bold">Plus {fmtInt(buffer)} extra, past your estimate. A buffer is a good thing.</p>}
          </Card>
        )}

        {/* 2. By prayer */}
        {!noDebtYet && (
          <Card>
            <CardTitle className="mb-2.5">Owed by prayer</CardTitle>
            <div className="flex flex-col gap-2">
              {prayers.map((p) => {
                const total = Math.max(state.initial[p], state.debt[p]);
                const remaining = Math.max(0, state.debt[p]);
                return (
                  <div key={p} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2.5 text-[13px] font-extrabold">
                    <span>{PRAYER_LABEL[p]}</span>
                    <DebtBar remaining={remaining} total={total} label={`${PRAYER_LABEL[p]}: ${fmtInt(remaining)} owed of ${fmtInt(total)}`} />
                    <span className="num min-w-[44px] text-right">{fmtInt(remaining)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* 3. Today's prayers */}
        <Card>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <CardTitle>Daily prayers</CardTitle>
            {pending.length > 0 && <Chip tone="yellow">{pending.length} pending</Chip>}
          </div>
          <div className={`grid gap-2 ${dense ? "grid-cols-3 min-[360px]:grid-cols-6" : "grid-cols-5"}`}>
            {prayers.map((p) => {
              const w = schedule.windows.find((x) => x.prayer === p);
              const st = tileState(p);
              // A prayer whose window has not opened cannot be answered yet.
              return <PrayerTile key={p} prayer={p} state={st} dense={dense} time={w ? fmtTimeShort(w.start, tz) : undefined} note={st === "now" ? leftLabel : undefined} onClick={st === "upcoming" ? undefined : () => setResolving(p)} />;
            })}
          </div>
          {pending.length > 1 ? (
            <Button block tone="yellow" className="mt-3" onClick={() => setReviewing(pending)}>
              Review {pending.length} pending prayers
            </Button>
          ) : (
            <p className="mt-2.5 text-[13px] font-semibold text-mute">
              {hasWindows ? "Tap a prayer to record or change it." : "Tap a prayer to record it. "}
              {!hasWindows && (
                <Link href="/settings" className="font-bold text-ink underline">
                  Add prayer times
                </Link>
              )}
            </p>
          )}
        </Card>

        {/* 4. Plan targets */}
        {state.activeStrategy && progress && (
          <Card tone="violet">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <CardTitle className="min-w-0 flex-1 truncate">{state.activeStrategy.name}</CardTitle>
              <Chip className="num">
                {progress.totalDone} of {progress.totalTarget} today
              </Chip>
            </div>
            {progress.targets.length === 0 ? (
              <p className="text-[13px] font-semibold">Nothing left to target. Every prayer this plan covers is clear.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {progress.targets.map((t) => (
                  <li key={t.ruleIndex} className="flex items-center justify-between gap-3 text-[13px] font-extrabold">
                    <span className="min-w-0 flex-1 truncate">{t.label}</span>
                    {t.count <= 8 ? (
                      <>
                        <span className="flex shrink-0 gap-1 max-[359px]:hidden" aria-hidden>
                          {Array.from({ length: t.count }, (_, i) => (
                            <i key={i} className={`grid h-[18px] w-[18px] place-items-center rounded-[5px] border-2 border-ink ${i < t.done ? "bg-paper" : "bg-violet"}`}>
                              {i < t.done && <Icon name="check" size={11} strokeWidth={4} />}
                            </i>
                          ))}
                        </span>
                        <span className="num shrink-0 min-[360px]:sr-only">
                          {t.done} of {t.count}
                        </span>
                      </>
                    ) : (
                      <span className="num shrink-0">
                        {t.done} of {t.count}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {!state.activeStrategy && !noDebtYet && (
          <Card tone="violet">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CardTitle>No plan yet</CardTitle>
                <p className="mt-1 text-[13px] font-semibold">A plan gives you daily targets and a finish date. You can change it any time.</p>
              </div>
              <Link href="/plan" className={buttonClass({ tone: "paper" })}>
                Choose a plan
              </Link>
            </div>
          </Card>
        )}

        {/* Actions: one loud primary, one quiet secondary. */}
        <div className="mt-1 flex flex-col gap-2">
          {showPrayedNow && current ? (
            <Button tone="coral" size="lg" block onClick={prayedNow}>
              I prayed {PRAYER_LABEL[current.prayer]}
            </Button>
          ) : pending.length === 1 ? (
            <Button tone="coral" size="lg" block onClick={() => setResolving(pending[0])}>
              Record {PRAYER_LABEL[pending[0]]}
            </Button>
          ) : pending.length > 1 ? (
            <Button tone="coral" size="lg" block onClick={() => setReviewing(pending)}>
              Review {pending.length} pending prayers
            </Button>
          ) : (
            <Button tone="coral" size="lg" block onClick={() => setLogOpen(true)} disabled={noDebtYet}>
              Log qada
            </Button>
          )}
          {(showPrayedNow || pending.length > 0) && (
            <Button block variant="flat" onClick={() => setLogOpen(true)} disabled={noDebtYet}>
              Log qada
            </Button>
          )}
        </div>
      </div>

      <PageFoot>
        <Sticker kind="tally" tone="orange" size={20} rotate={-6} inline />
        <Sticker kind="dot" tone="teal" size={16} inline />
      </PageFoot>

      <ResolveSheet
        target={resolving ? { prayer: resolving, prayerDay: schedule.prayerDay } : null}
        existing={resolving ? state.resolutions[resolutionKey(schedule.prayerDay, resolving)] : undefined}
        onClose={() => setResolving(null)}
        hasWindows={hasWindows}
      />
      <ReviewSheet open={Boolean(reviewing)} onClose={() => setReviewing(null)} prayers={reviewing ?? []} prayerDay={schedule.prayerDay} state={state} />
      <QuickLogSheet open={logOpen} onClose={() => setLogOpen(false)} prayers={prayers} today={schedule.prayerDay} owed={state.debt} defaultPrayer={progress?.targets.find((t) => t.done < t.count)?.prayer} />
    </>
  );
}
