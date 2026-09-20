"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { PaceCards } from "@/components/PaceCards";
import { StrategyEditorSheet } from "@/components/StrategyEditor";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageFoot, Sticker } from "@/components/ui/Sticker";
import { useToast } from "@/components/ui/Toast";
import { localDateString, shiftDay } from "@/domain/prayerDay";
import { adherence, dailyTargetCount, daysBetween, paceFinish, progressFor, simulateFinish, TEMPLATES, uncoveredPrayers } from "@/domain/strategy";
import { PRAYER_LABEL, type Prayer, type Rule, type Strategy } from "@/domain/types";
import { fmtDay, fmtMonth, fmtRelativeDays } from "@/lib/format";
import { useLedger, useLedgerActions, useSettings } from "@/store/hooks";
import { trackedPrayers, useNow, useSchedule } from "@/store/useSchedule";

export function ruleText(r: Rule): { count: number; rest: string } {
  const q = (x: string) => (x === "next_in_order" ? "of whichever is next" : PRAYER_LABEL[x as Prayer]);
  if (r.kind === "with_daily") return { count: r.count, rest: `${r.qada === "same" ? PRAYER_LABEL[r.daily] : q(r.qada)} after each daily ${PRAYER_LABEL[r.daily]}` };
  if (r.kind === "block") return { count: r.count, rest: `${q(r.qada)}${r.after === "any" ? "" : ` after ${PRAYER_LABEL[r.after]}`} (${r.label})` };
  return { count: r.count, rest: `${q(r.qada)} every day` };
}

export function OrderChips({ order }: { order: Prayer[] }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Order">
      {order.map((p, i) => (
        <li key={p}>
          <Chip>
            <span className="num text-mute">{i + 1}</span>
            {PRAYER_LABEL[p]}
          </Chip>
        </li>
      ))}
    </ol>
  );
}

export function PlanScreen() {
  const now = useNow();
  const { settings } = useSettings();
  const { state, ready } = useLedger();
  const { schedule } = useSchedule(settings, state, now);
  const { append, revoke } = useLedgerActions();
  const toast = useToast();
  const prayers = trackedPrayers(settings);
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<Strategy | null>(null);

  const active = state.activeStrategy;
  const today = schedule.prayerDay;
  const tz = settings.prayer.location?.tz ?? "UTC";
  const progress = useMemo(() => (active ? progressFor(today, state, active) : undefined), [active, today, state]);
  const planFinish = useMemo(() => (active ? simulateFinish(state.debt, active, today) : undefined), [active, state.debt, today]);
  const pace = useMemo(() => paceFinish(state, today, 30), [state, today]);
  const isEdit = Boolean(editing && active && editing.strategyId === active.strategyId);
  const uncovered = active ? uncoveredPrayers(state, active) : [];
  const firstDay = state.events[0] ? localDateString(new Date(state.events[0].occurredAt), tz) : today;
  const historyDays = daysBetween(firstDay, today).length;

  async function start(s: Strategy) {
    const e = await append({ type: "strategy.started", payload: { v: 1, ...s, strategyId: crypto.randomUUID() } });
    setPicker(false);
    setEditing(null);
    toast({ message: `Plan "${s.name}" started.`, tone: "teal", action: { label: "Undo", onClick: () => revoke(e.id) } });
  }

  async function stop() {
    if (!active) return;
    const e = await append({ type: "strategy.stopped", payload: { v: 1, strategyId: active.strategyId } });
    toast({ message: "Plan stopped. Your ledger is untouched.", action: { label: "Undo", onClick: () => revoke(e.id) } });
  }

  const periods = [...state.periods].reverse();

  return (
    <>
      <Header title="Plan" sub="Daily targets, finish dates and history" sticker={<Sticker kind="star" tone="violet" size={22} rotate={12} inline />} />

      <div className="flex flex-col gap-3">
        {!ready ? (
          <Card aria-busy="true">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-3 h-10 w-full" />
            <Skeleton className="mt-2 h-10 w-full" />
          </Card>
        ) : active ? (
          <Card tone="violet">
            <div className="mb-3 flex items-start justify-between gap-3">
              <CardTitle className="line-clamp-2 min-w-0 flex-1 text-[17px]">{active.name}</CardTitle>
              {progress && (
                <Chip className="num mt-0.5">
                  {progress.totalDone} of {progress.totalTarget} today
                </Chip>
              )}
            </div>
            <ul className="mb-3 flex flex-col gap-2">
              {active.rules.map((r, i) => {
                const t = ruleText(r);
                return (
                  <li key={i} className="brut-sm line-clamp-2 rounded-[var(--r-sm)] px-3 py-2 text-[13px] font-bold leading-snug">
                    <span className="num mr-1.5 text-[15px] font-black">{t.count}</span>
                    {t.rest}
                  </li>
                );
              })}
            </ul>
            {active.rules.some((r) => r.qada === "next_in_order") && (
              <div className="mb-3">
                <div className="mb-1.5 text-[11px] font-black tracking-[0.04em]">NEXT IN ORDER</div>
                <OrderChips order={active.order} />
              </div>
            )}
            {uncovered.length > 0 && (
              <p className="mb-3 rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-paper px-3 py-2 text-[13px] font-bold">
                {uncovered.map((p) => PRAYER_LABEL[p]).join(" and ")} {uncovered.length === 1 ? "is" : "are"} not covered by this plan, so {uncovered.length === 1 ? "it" : "they"} will not go down. Edit the plan to add a rule.
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button className="flex-1" onClick={() => setEditing(active)}>
                Edit
              </Button>
              <Button className="flex-1" variant="flat" onClick={() => setPicker(true)}>
                Switch plan
              </Button>
            </div>
            <button type="button" onClick={stop} className="mt-2 min-h-[44px] w-full text-[13px] font-extrabold underline">
              Stop this plan
            </button>
          </Card>
        ) : (
          <Card tone="violet">
            <CardTitle className="text-[17px]">No plan active</CardTitle>
            <p className="mb-3 mt-1 text-[13px] font-semibold">A plan turns what you owe into daily targets and a finish date. Switch whenever you like: nothing you have logged ever changes.</p>
            <Button block tone="coral" onClick={() => setPicker(true)}>
              Choose a plan
            </Button>
          </Card>
        )}

        <PaceCards planFinish={planFinish} hasPlan={Boolean(active)} perDay={active ? dailyTargetCount(state, active) : undefined} pace={pace} historyDays={historyDays} />

        <section className="mt-2">
          <h2 className="mb-2 text-[17px] font-black tracking-[-0.01em]">History</h2>
          {periods.length === 0 ? (
            <Card className="py-6 text-center">
              <p className="text-[13px] font-semibold text-mute">Every plan you run is kept here with how much of it you met, so you can compare what works for you.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {periods.map((p) => {
                const startDay = localDateString(new Date(p.startedAt), tz);
                const running = !p.endedAt;
                const endDay = p.endedAt ? localDateString(new Date(p.endedAt), tz) : today;
                // A running period is measured on completed days only, so a fresh day never reads as 0%.
                const measured = running ? daysBetween(startDay, shiftDay(today, -1)) : daysBetween(startDay, endDay);
                const a = adherence(measured, state, p.strategy);
                const span = daysBetween(startDay, endDay).length;
                return (
                  <Card key={p.eventId} tone={running ? "violet" : "paper"}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[15px] font-black leading-tight">{p.strategy.name}</div>
                        <div className="mt-1 text-[13px] font-semibold">
                          {fmtDay(startDay)} to {running ? "now" : fmtDay(endDay)}, {span} {span === 1 ? "day" : "days"}
                        </div>
                      </div>
                      <Chip className="num mt-0.5">{a === undefined ? (running ? "first day" : "no targets") : `${Math.round(a * 100)}% of targets met`}</Chip>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <PageFoot>
        <Sticker kind="square" tone="teal" size={16} rotate={-10} inline />
        <Sticker kind="squiggle" tone="violet" size={18} inline />
      </PageFoot>

      <Sheet open={picker} onClose={() => setPicker(false)} title="Choose a plan">
        <p className="mb-3 text-[13px] font-semibold text-mute">Each date is when you would finish if you met the plan every day, from what you owe now.</p>
        <div className="flex flex-col gap-3">
          {TEMPLATES.map((t) => {
            const built = t.build(active?.order ?? prayers);
            const finish = simulateFinish(state.debt, built, today);
            return (
              <button key={t.id} type="button" onClick={() => setEditing(built)} className="brut pressable rounded-[var(--r-btn)] bg-paper px-4 py-3 text-left">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[15px] font-black">{t.name}</span>
                  {finish && finish.days > 0 && <Chip tone="violet">{fmtMonth(finish.finishDay)}</Chip>}
                </div>
                <div className="mt-1 text-[13px] font-semibold text-mute">
                  {t.description}
                  {finish && finish.days > 0 ? ` About ${fmtRelativeDays(finish.days)}.` : ""}
                </div>
              </button>
            );
          })}
          <button type="button" onClick={() => setEditing({ strategyId: crypto.randomUUID(), name: "My plan", rules: [{ kind: "with_daily", daily: "fajr", qada: "same", count: 2 }], order: prayers })} className="brut pressable rounded-[var(--r-btn)] bg-violet px-4 py-3 text-left">
            <div className="text-[15px] font-black">Build my own</div>
            <div className="mt-1 text-[13px] font-semibold">Start from one example rule and shape it your way.</div>
          </button>
        </div>
      </Sheet>

      <StrategyEditorSheet initial={editing} prayers={prayers} isEdit={isEdit} onSave={start} onClose={() => setEditing(null)} />
    </>
  );
}
