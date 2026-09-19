"use client";

import { useMemo } from "react";
import { Header } from "@/components/Header";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { localDateString, shiftDay } from "@/domain/prayerDay";
import { daysBetween, paceFinish, simulateFinish } from "@/domain/strategy";
import { PRAYER_LABEL, RAKAH, type Prayer } from "@/domain/types";
import { fmtDay, fmtInt, fmtMonth, fmtRelativeDays } from "@/lib/format";
import { useLedger, useSettings, useSettingsActions } from "@/store/hooks";
import { trackedPrayers, useNow, useSchedule } from "@/store/useSchedule";

export function StatsScreen() {
  const now = useNow();
  const { settings } = useSettings();
  const { patch } = useSettingsActions();
  const { state, ready } = useLedger();
  const { schedule } = useSchedule(settings, state, now);
  const prayers = trackedPrayers(settings);
  const today = schedule.prayerDay;
  const rakah = settings.display.rakahView;
  const weight = (p: Prayer) => (rakah ? RAKAH[p] : 1);

  const owed = prayers.reduce((s, p) => s + Math.max(0, state.debt[p]) * weight(p), 0);
  const initial = prayers.reduce((s, p) => s + state.initial[p] * weight(p), 0);

  const last7 = useMemo(() => {
    const days = daysBetween(shiftDay(today, -6), today);
    return days.map((d) => {
      const q = Object.entries(state.qadaByDay[d] ?? {}).reduce((s, [p, n]) => s + (n ?? 0) * weight(p as Prayer), 0);
      const missed = Object.entries(state.resolutions).filter(([k, r]) => k.startsWith(`${d}|`) && r.status === "missed").length;
      return { day: d, qada: q, missed };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, today, rakah]);

  const series = useMemo(() => {
    // Cumulative debt by day from the events themselves.
    const tz = settings.prayer.location?.tz ?? "UTC";
    let debt = 0;
    const points: { day: string; debt: number }[] = [];
    for (const e of state.events) {
      const day = e.type === "qada.logged" || e.type === "daily.resolved" ? e.payload.prayerDay : localDateString(new Date(e.occurredAt), e.tz);
      if (e.type === "debt.set_initial") debt += e.payload.count * weight(e.payload.prayer);
      else if (e.type === "debt.adjust") debt += e.payload.delta * weight(e.payload.prayer);
      else if (e.type === "qada.logged") debt -= e.payload.count * weight(e.payload.prayer);
      else if (e.type === "daily.resolved" && e.payload.status === "missed") debt += weight(e.payload.prayer);
      else continue;
      const last = points.at(-1);
      if (last && last.day === day) last.debt = debt;
      else points.push({ day, debt });
    }
    void tz;
    return points;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.events, rakah]);

  const pace = paceFinish(state, today, 30);
  const planFinish = state.activeStrategy ? simulateFinish(state.debt, state.activeStrategy, today) : undefined;
  const maxBar = Math.max(1, ...last7.map((d) => d.qada));
  const avg7 = last7.reduce((s, d) => s + d.qada, 0) / 7;

  const W = 320;
  const H = 110;
  const path = useMemo(() => {
    if (series.length < 2) return "";
    const max = Math.max(...series.map((p) => p.debt), 1);
    const min = Math.min(...series.map((p) => p.debt), 0);
    const x = (i: number) => (i / (series.length - 1)) * (W - 8) + 4;
    const y = (v: number) => H - 6 - ((v - min) / (max - min || 1)) * (H - 12);
    return series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.debt).toFixed(1)}`).join(" ");
  }, [series]);

  return (
    <>
      <Header
        title="Stats"
        right={
          <button type="button" onClick={() => patch((d) => ({ ...d, display: { ...d.display, rakahView: !d.display.rakahView } }))} className="pressable">
            <Chip tone={rakah ? "sky" : "paper"}>{rakah ? "Rak'ah" : "Prayers"}</Chip>
          </button>
        }
      />

      {!ready ? null : (
        <div className="flex flex-col gap-3">
          <Card>
            <div className="flex items-end justify-between gap-3">
              <div>
                <CardTitle>{rakah ? "Rak'ah owed" : "Prayers owed"}</CardTitle>
                <div className="display num text-[44px]">{fmtInt(owed)}</div>
              </div>
              <div className="text-right text-[12px] font-bold text-mute">
                of {fmtInt(initial)} at the start
                <div className="num mt-1 text-ink">{initial > 0 ? `${Math.round(((initial - owed) / initial) * 100)}% cleared` : ""}</div>
              </div>
            </div>
          </Card>

          <Card tone="teal">
            <div className="mb-2 flex items-center justify-between">
              <CardTitle>Last 7 days</CardTitle>
              <span className="num text-[12px] font-bold">avg {avg7.toFixed(1)} a day</span>
            </div>
            <div className="flex h-[64px] items-end gap-1.5" role="img" aria-label="Qada logged per day for the last seven days">
              {last7.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-[5px] border-2 border-ink ${d.day === today ? "bg-yellow" : d.missed > 0 ? "bg-coral" : "bg-paper"}`}
                    style={{ height: `${Math.max(6, (d.qada / maxBar) * 56)}px`, boxShadow: "2px 2px 0 var(--ink)" }}
                    title={`${fmtDay(d.day)}: ${d.qada} qada${d.missed ? `, ${d.missed} missed` : ""}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1.5 text-[10px] font-bold">
              {last7.map((d) => (
                <div key={d.day} className="flex-1 text-center">
                  {fmtDay(d.day).slice(0, 2)}
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] font-semibold">Coral marks a day with a missed daily prayer.</div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardTitle>Plan pace</CardTitle>
              <div className="display num mt-1 text-[24px]">{planFinish ? (planFinish.days === 0 ? "Done" : fmtMonth(planFinish.finishDay)) : "—"}</div>
              <div className="mt-1 text-[11px] font-semibold text-mute">{planFinish && planFinish.days > 0 ? fmtRelativeDays(planFinish.days) : "no active plan"}</div>
            </Card>
            <Card>
              <CardTitle>Your pace</CardTitle>
              <div className="display num mt-1 text-[24px]">{pace.finishDay ? (pace.daysToFinish === 0 ? "Done" : fmtMonth(pace.finishDay)) : "—"}</div>
              <div className="mt-1 text-[11px] font-semibold text-mute">{pace.finishDay && pace.daysToFinish ? fmtRelativeDays(pace.daysToFinish) : "not finishing at this pace"}</div>
            </Card>
          </div>

          <Card>
            <CardTitle className="mb-2">Debt over time</CardTitle>
            {series.length < 2 ? (
              <p className="text-[12px] font-semibold text-mute">A line appears once you have logged on two different days.</p>
            ) : (
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Debt over time">
                <path d={`${path} L${W - 4},${H - 6} L4,${H - 6} Z`} fill="var(--sky)" opacity="0.6" />
                <path d={path} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            )}
            {series.length >= 2 && (
              <div className="mt-1 flex justify-between text-[10px] font-bold text-mute">
                <span>{fmtDay(series[0].day)}</span>
                <span>{fmtDay(series.at(-1)!.day)}</span>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle className="mb-2">Per prayer</CardTitle>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] font-bold">
              {prayers.map((p) => (
                <div key={p} className="flex justify-between border-b-2 border-dotted border-ink/30 py-1">
                  <span>{PRAYER_LABEL[p]}</span>
                  <span className="num">
                    {fmtInt(Math.max(0, state.debt[p]) * weight(p))}
                    {state.debt[p] < 0 ? ` (+${fmtInt(-state.debt[p] * weight(p))})` : ""}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
