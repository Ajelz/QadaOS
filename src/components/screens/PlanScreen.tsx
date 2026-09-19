"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { StrategyEditor } from "@/components/StrategyEditor";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { localDateString } from "@/domain/prayerDay";
import { adherence, daysBetween, paceFinish, progressFor, simulateFinish, TEMPLATES } from "@/domain/strategy";
import { PRAYER_LABEL, type Prayer, type Rule, type Strategy } from "@/domain/types";
import { fmtDay, fmtMonth, fmtRelativeDays } from "@/lib/format";
import { useLedger, useLedgerActions, useSettings } from "@/store/hooks";
import { trackedPrayers, useNow, useSchedule } from "@/store/useSchedule";

function ruleText(r: Rule): string {
  const q = (x: string) => (x === "same" ? "of the same prayer" : x === "next_in_order" ? "of next in order" : PRAYER_LABEL[x as Prayer]);
  if (r.kind === "with_daily") return `${r.count} ${q(r.qada)} after daily ${PRAYER_LABEL[r.daily]}`;
  if (r.kind === "block") return `${r.label}: ${r.count} ${q(r.qada)}${r.after === "any" ? "" : ` after ${PRAYER_LABEL[r.after]}`}`;
  return `${r.count} ${q(r.qada)} each day`;
}

export function PlanScreen() {
  const now = useNow();
  const { settings } = useSettings();
  const { state, ready } = useLedger();
  const { schedule } = useSchedule(settings, state, now);
  const { append } = useLedgerActions();
  const toast = useToast();
  const prayers = trackedPrayers(settings);
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<Strategy | null>(null);

  const active = state.activeStrategy;
  const today = schedule.prayerDay;
  const progress = useMemo(() => (active ? progressFor(today, state, active) : undefined), [active, today, state]);
  const planFinish = useMemo(() => (active ? simulateFinish(state.debt, active, today) : undefined), [active, state.debt, today]);
  const pace = useMemo(() => paceFinish(state, today, 30), [state, today]);

  async function start(s: Strategy) {
    await append({ type: "strategy.started", payload: { v: 1, ...s, strategyId: crypto.randomUUID() } });
    setPicker(false);
    setEditing(null);
    toast({ message: `Plan "${s.name}" started.`, tone: "teal" });
  }

  async function stop() {
    if (!active) return;
    await append({ type: "strategy.stopped", payload: { v: 1, strategyId: active.strategyId } });
    toast({ message: "Plan stopped. Your ledger is untouched." });
  }

  const periods = [...state.periods].reverse();

  return (
    <>
      <Header title="Plan" sub="Targets, projections and history" />

      <div className="flex flex-col gap-3">
        {!ready ? null : active ? (
          <Card tone="violet">
            <div className="mb-2 flex items-center justify-between">
              <CardTitle className="text-[16px]">{active.name}</CardTitle>
              {progress && (
                <Chip className="num">
                  today {progress.totalDone} of {progress.totalTarget}
                </Chip>
              )}
            </div>
            <ul className="mb-3 flex flex-col gap-1 text-[13px] font-bold">
              {active.rules.map((r, i) => (
                <li key={i} className="brut-flat rounded-[8px] px-2.5 py-1.5">
                  {ruleText(r)}
                </li>
              ))}
            </ul>
            <div className="text-[12px] font-semibold">Order: {active.order.map((p) => PRAYER_LABEL[p]).join(" → ")}</div>
            <div className="mt-3 flex gap-2">
              <Button block onClick={() => setEditing(active)}>
                Edit
              </Button>
              <Button block onClick={() => setPicker(true)}>
                Switch
              </Button>
              <Button block tone="paper" onClick={stop}>
                Stop
              </Button>
            </div>
          </Card>
        ) : (
          <Card tone="violet">
            <CardTitle>No plan active</CardTitle>
            <p className="mb-3 mt-1 text-[12px] font-semibold">A plan turns your debt into daily targets and a finish date. Switch any time; nothing you have logged changes.</p>
            <Button block onClick={() => setPicker(true)}>
              Choose a plan
            </Button>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardTitle>Plan pace</CardTitle>
            <div className="display num mt-1 text-[26px]">{planFinish ? (planFinish.days === 0 ? "Done" : fmtMonth(planFinish.finishDay)) : "—"}</div>
            <div className="mt-1 text-[11px] font-semibold text-mute">{planFinish && planFinish.days > 0 ? fmtRelativeDays(planFinish.days) : active ? "plan makes no progress" : "no plan"}</div>
          </Card>
          <Card>
            <CardTitle>Your pace</CardTitle>
            <div className="display num mt-1 text-[26px]">{pace.finishDay ? (pace.daysToFinish === 0 ? "Done" : fmtMonth(pace.finishDay)) : "—"}</div>
            <div className="mt-1 text-[11px] font-semibold text-mute">
              {pace.finishDay && pace.daysToFinish ? fmtRelativeDays(pace.daysToFinish) : pace.netPerDay <= 0 ? "not finishing at this pace" : ""}
              {` · net ${pace.netPerDay.toFixed(1)}/day`}
            </div>
          </Card>
        </div>

        <section>
          <h2 className="mb-1.5 px-1 text-[12px] font-extrabold text-mute">History</h2>
          {periods.length === 0 ? (
            <Card>
              <p className="text-[12px] font-semibold text-mute">Every plan you run appears here with its adherence.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {periods.map((p) => {
                const startDay = localDateString(new Date(p.startedAt), settings.prayer.location?.tz ?? "UTC");
                const endDay = p.endedAt ? localDateString(new Date(p.endedAt), settings.prayer.location?.tz ?? "UTC") : today;
                const days = daysBetween(startDay, endDay);
                const a = adherence(days, state, p.strategy);
                return (
                  <Card key={p.eventId} className={p.endedAt ? "" : "bg-yellow"}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[14px] font-extrabold">{p.strategy.name}</div>
                        <div className="text-[11px] font-semibold text-mute">
                          {fmtDay(startDay)} → {p.endedAt ? fmtDay(endDay) : "now"} · {days.length} {days.length === 1 ? "day" : "days"}
                        </div>
                      </div>
                      <Chip tone={a === undefined ? "grey" : a >= 0.8 ? "teal" : a >= 0.5 ? "yellow" : "coral"} className="num">
                        {a === undefined ? "no targets" : `${Math.round(a * 100)}% adherence`}
                      </Chip>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Sheet open={picker} onClose={() => setPicker(false)} title="Choose a plan">
        <div className="flex flex-col gap-2">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => setEditing(t.build(active?.order ?? prayers))} className="brut pressable rounded-[12px] bg-paper px-3.5 py-3 text-left">
              <div className="text-[14px] font-extrabold">{t.name}</div>
              <div className="text-[12px] font-semibold text-mute">{t.description}</div>
            </button>
          ))}
          <button type="button" onClick={() => setEditing({ strategyId: crypto.randomUUID(), name: "My plan", rules: [], order: prayers })} className="brut pressable rounded-[12px] bg-yellow px-3.5 py-3 text-left">
            <div className="text-[14px] font-extrabold">Build my own</div>
            <div className="text-[12px] font-semibold">Start from an empty plan.</div>
          </button>
        </div>
      </Sheet>

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing && active && editing.strategyId === active.strategyId ? "Edit plan" : "New plan"}>
        {editing && <StrategyEditor initial={editing} prayers={prayers} onCancel={() => setEditing(null)} onSave={start} />}
        <p className="mt-3 text-[11px] font-semibold text-mute">Saving starts a new period. The previous one closes today and keeps its report.</p>
      </Sheet>
    </>
  );
}
