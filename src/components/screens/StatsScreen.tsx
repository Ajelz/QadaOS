"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { PaceCards } from "@/components/PaceCards";
import { Card, CardTitle } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { PageFoot, Sticker } from "@/components/ui/Sticker";
import { activityBuckets, type ActivityWindow } from "@/domain/activity";
import { localDateString } from "@/domain/prayerDay";
import { dailyTargetCount, daysBetween, paceFinish, simulateFinish } from "@/domain/strategy";
import { PRAYER_LABEL, RAKAH, type Prayer } from "@/domain/types";
import { fmtDay, fmtInt } from "@/lib/format";
import { useLedger, useSettings, useSettingsActions } from "@/store/hooks";
import { trackedPrayers, useNow, useSchedule } from "@/store/useSchedule";

const W = 320;
const H = 96;
const TRACK = 64;

export function StatsScreen() {
  const now = useNow();
  const { settings } = useSettings();
  const { patch } = useSettingsActions();
  const { state, ready } = useLedger();
  const { schedule } = useSchedule(settings, state, now);
  const prayers = trackedPrayers(settings);
  const today = schedule.prayerDay;
  const rakah = settings.display.rakahView;
  const unit = rakah ? "rak'ah" : "prayers";

  const { owed, initial, cleared } = useMemo(() => {
    const w = (p: Prayer) => (rakah ? RAKAH[p] : 1);
    const owed = prayers.reduce((s, p) => s + Math.max(0, state.debt[p]) * w(p), 0);
    const initial = prayers.reduce((s, p) => s + state.initial[p] * w(p), 0);
    return { owed, initial, cleared: Math.max(0, initial - owed) };
  }, [prayers, state.debt, state.initial, rakah]);

  const [windowDays, setWindowDays] = useState<ActivityWindow>(7);
  const buckets = useMemo(() => activityBuckets(state, today, windowDays, (p) => (rakah ? RAKAH[p] : 1)), [state, today, windowDays, rakah]);

  const series = useMemo(() => {
    const w = (p: Prayer) => (rakah ? RAKAH[p] : 1);
    let debt = 0;
    const points: { day: string; debt: number }[] = [];
    const ordered = [...state.events].sort((a, b) => {
      const da = a.type === "qada.logged" || a.type === "daily.resolved" ? a.payload.prayerDay : localDateString(new Date(a.occurredAt), a.tz);
      const db = b.type === "qada.logged" || b.type === "daily.resolved" ? b.payload.prayerDay : localDateString(new Date(b.occurredAt), b.tz);
      return da < db ? -1 : da > db ? 1 : 0;
    });
    for (const e of ordered) {
      const day = e.type === "qada.logged" || e.type === "daily.resolved" ? e.payload.prayerDay : localDateString(new Date(e.occurredAt), e.tz);
      if (e.type === "debt.set_initial") debt += e.payload.count * w(e.payload.prayer);
      else if (e.type === "debt.adjust") debt += e.payload.delta * w(e.payload.prayer);
      else if (e.type === "qada.logged") debt -= e.payload.count * w(e.payload.prayer);
      else if (e.type === "daily.resolved" && e.payload.status === "missed") debt += w(e.payload.prayer);
      else continue;
      const last = points.at(-1);
      if (last && last.day === day) last.debt = debt;
      else points.push({ day, debt });
    }
    return points;
  }, [state.events, rakah]);

  const pace = useMemo(() => paceFinish(state, today, 30), [state, today]);
  const planFinish = useMemo(() => (state.activeStrategy ? simulateFinish(state.debt, state.activeStrategy, today) : undefined), [state.activeStrategy, state.debt, today]);
  const maxBar = Math.max(1, ...buckets.map((b) => b.qada));
  const totalQada = buckets.reduce((s, b) => s + b.qada, 0);
  const totalMissed = buckets.reduce((s, b) => s + b.missed, 0);
  const daily = windowDays !== 90;
  const detailed = windowDays === 7;

  const plot = useMemo(() => {
    if (series.length < 2) return null;
    const values = series.map((p) => p.debt);
    const rawMax = Math.max(...values);
    const rawMin = Math.min(...values);
    const pad = (rawMax - rawMin) * 0.15 || 1;
    const max = rawMax + pad;
    const min = Math.max(0, rawMin - pad);
    const x = (i: number) => 6 + (i / (series.length - 1)) * (W - 12);
    const y = (v: number) => H - 6 - ((v - min) / (max - min || 1)) * (H - 12);
    const pts = series.map((p, i) => [x(i), y(p.debt)] as const);
    const line = pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
    return { line, area: `${line} L${pts.at(-1)![0].toFixed(1)},${H - 1} L${pts[0][0].toFixed(1)},${H - 1} Z`, first: pts[0], last: pts.at(-1)! };
  }, [series]);

  return (
    <>
      <Header title="Stats" sub="Where you stand and how fast you are moving" sticker={<Sticker kind="dot" tone="sky" size={18} inline />} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-extrabold" id="unit-label">
          Count in
        </span>
        <Segmented
          label="Count in prayers or rak'ah"
          value={rakah ? "rakah" : "prayers"}
          onChange={(v) => patch((d) => ({ ...d, display: { ...d.display, rakahView: v === "rakah" } }))}
          options={[
            { value: "prayers", label: "Prayers" },
            { value: "rakah", label: "Rak'ah" },
          ]}
        />
      </div>
      {rakah && <p className="mb-3 text-[13px] font-semibold text-mute">Rak&apos;ah weighs each prayer by its length (Fajr 2, Dhuhr 4, Asr 4, Maghrib 3, Isha 4), so clearing Fajr first does not overstate your progress.</p>}

      {!ready ? null : (
        <div className="flex flex-col gap-3">
          <Card tone="sky">
            <div className="flex flex-col items-start gap-2 min-[360px]:flex-row min-[360px]:items-end min-[360px]:justify-between">
              <div className="min-w-0">
                <CardTitle>{rakah ? "Rak'ah owed" : "Prayers owed"}</CardTitle>
                <div className="display num mt-1 text-[clamp(30px,11vw,44px)]">{fmtInt(owed)}</div>
              </div>
              <div className="text-[13px] font-bold min-[360px]:text-right">
                <div className="num">{fmtInt(cleared)} cleared</div>
                <div className="num">of {fmtInt(initial)} at the start</div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Qada you made up</CardTitle>
              <Segmented
                label="Period"
                tone="violet"
                value={String(windowDays) as "7" | "30" | "90"}
                onChange={(v) => setWindowDays(Number(v) as ActivityWindow)}
                options={[
                  { value: "7", label: "7 days" },
                  { value: "30", label: "30" },
                  { value: "90", label: "90" },
                ]}
              />
            </div>
            {totalQada === 0 ? (
              <p className="rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-cream px-3 py-4 text-center text-[13px] font-extrabold">Nothing logged in the last {windowDays} days.</p>
            ) : (
              <>
                <div className={`flex ${detailed ? "gap-1.5" : "gap-[3px]"}`} role="img" aria-label={`Qada per ${daily ? "day" : "week"} over the last ${windowDays} days, ${fmtInt(totalQada)} in total. ${buckets.filter((b) => b.qada > 0).map((b) => `${fmtDay(b.start)}: ${b.qada}`).join(", ")}`}>
                  {buckets.map((b) => (
                    <div key={b.start} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      {detailed && <span className="num text-[11px] font-black leading-none">{b.qada > 0 ? fmtInt(b.qada) : "\u00a0"}</span>}
                      <div className={`relative w-full overflow-hidden border-ink bg-cream ${detailed ? "rounded-t-[6px] border-[length:var(--bw)]" : "rounded-t-[3px] border-2"}`} style={{ height: TRACK }}>
                        <div className={`absolute inset-x-0 bottom-0 ${b.isCurrent ? "bg-yellow" : "bg-violet"} ${detailed && b.qada > 0 && b.qada < maxBar ? "border-t-[length:var(--bw)] border-ink" : ""}`} style={{ height: `${b.qada === 0 ? 0 : Math.max(8, (b.qada / maxBar) * 100)}%` }} />
                      </div>
                      {detailed && (
                        <>
                          <span className="text-[11px] font-black leading-none">{fmtDay(b.start).slice(0, 2)}</span>
                          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${b.missed > 0 ? "bg-ink" : "bg-transparent"}`} />
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {!detailed && (
                  <div className="mt-1.5 flex justify-between text-[11px] font-extrabold">
                    <span>{fmtDay(buckets[0].start)}</span>
                    <span>{daily ? "one bar a day" : "one bar a week"}</span>
                    <span>{fmtDay(buckets.at(-1)!.end)}</span>
                  </div>
                )}
              </>
            )}
            <p className="mt-2 text-[13px] font-bold">
              <span className="num">{fmtInt(totalQada)}</span> made up{totalMissed > 0 ? (
                <>
                  , <span className="num">{fmtInt(totalMissed)}</span> daily {totalMissed === 1 ? "prayer" : "prayers"} missed
                </>
              ) : null}{" "}
              in {windowDays} days.
            </p>
            {totalQada > 0 && <p className="mt-1 text-[11px] font-semibold text-mute">Yellow is {daily ? "today" : "this week"}.{detailed && totalMissed > 0 ? " A dot marks a day with a missed daily prayer." : ""}</p>}
          </Card>

          <PaceCards planFinish={planFinish} hasPlan={Boolean(state.activeStrategy)} perDay={state.activeStrategy ? dailyTargetCount(state, state.activeStrategy) : undefined} pace={pace} historyDays={series.length ? daysBetween(series[0].day, today).length : 0} />

          <Card>
            <CardTitle className="mb-2.5">What you owe over time</CardTitle>
            {!plot ? (
              <p className="rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-cream px-3 py-4 text-center text-[13px] font-extrabold">A line appears once you have entries on two different days.</p>
            ) : (
              <>
                <svg viewBox={`0 0 ${W} ${H}`} className="block w-full rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-paper" role="img" aria-label={`From ${fmtInt(series[0].debt)} on ${fmtDay(series[0].day)} to ${fmtInt(series.at(-1)!.debt)} on ${fmtDay(series.at(-1)!.day)}`}>
                  <path d={plot.area} fill="var(--sky-tint)" />
                  <path d={plot.line} fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="miter" strokeLinecap="square" vectorEffect="non-scaling-stroke" />
                  <rect x={plot.first[0] - 3.5} y={plot.first[1] - 3.5} width="7" height="7" fill="var(--ink)" />
                  <rect x={plot.last[0] - 3.5} y={plot.last[1] - 3.5} width="7" height="7" fill="var(--ink)" />
                </svg>
                <div className="mt-1.5 flex justify-between gap-3 text-[11px] font-extrabold">
                  <span className="num">
                    {fmtInt(series[0].debt)} · {fmtDay(series[0].day)}
                  </span>
                  <span className="num text-right">
                    {fmtInt(series.at(-1)!.debt)} · {fmtDay(series.at(-1)!.day)}
                  </span>
                </div>
              </>
            )}
          </Card>

          <Card padded={false}>
            <table className="w-full text-[13px] font-extrabold">
              <caption className="border-b-[length:var(--bw)] border-ink bg-ink px-4 py-2 text-left text-[13px] font-black text-cream">By prayer, in {unit}</caption>
              <thead>
                <tr className="text-left text-[11px] text-mute">
                  <th scope="col" className="py-1.5 pl-4 font-extrabold">Prayer</th>
                  <th scope="col" className="py-1.5 text-right font-extrabold">Owed</th>
                  <th scope="col" className="py-1.5 pl-2 pr-4 text-right font-extrabold">Cleared</th>
                </tr>
              </thead>
              <tbody>
                {prayers.map((p) => {
                  const w = rakah ? RAKAH[p] : 1;
                  return (
                    <tr key={p} className="border-t-2 border-ink">
                      <th scope="row" className="py-2 pl-4 text-left font-black">{PRAYER_LABEL[p]}</th>
                      <td className="num py-2 text-right">{fmtInt(Math.max(0, state.debt[p]) * w)}</td>
                      <td className="num py-2 pl-2 pr-4 text-right">{fmtInt(Math.max(0, state.initial[p] - Math.max(0, state.debt[p])) * w)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <PageFoot>
        <Sticker kind="squiggle" tone="yellow" size={18} inline />
        <Sticker kind="sparkle" tone="sky" size={20} inline />
      </PageFoot>
    </>
  );
}
