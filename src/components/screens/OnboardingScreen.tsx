"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LocationPicker } from "@/components/LocationPicker";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Sticker } from "@/components/ui/Sticker";
import { useToast } from "@/components/ui/Toast";
import type { SettingsDoc } from "@/domain/schemas";
import { TEMPLATES } from "@/domain/strategy";
import { FARD_PRAYERS, PRAYER_LABEL, type Prayer } from "@/domain/types";
import { fmtInt } from "@/lib/format";
import { isIosNotInstalled, pushSupported, enablePush } from "@/lib/pushClient";
import { useLedgerActions, useSettings, useSettingsActions } from "@/store/hooks";

const STEPS = ["Where", "How", "Owed", "Plan", "Remind"] as const;
const selectCls = "brut-sm rounded-[8px] bg-paper px-2.5 py-2 text-[13px] font-bold";
const inputCls = "brut-sm num rounded-[8px] bg-paper px-2.5 py-2 text-[16px] font-extrabold w-full";

function daysBetweenDates(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function OnboardingScreen() {
  const router = useRouter();
  const toast = useToast();
  const { settings } = useSettings();
  const { patch } = useSettingsActions();
  const { append } = useLedgerActions();
  const [step, setStep] = useState(0);

  // Local draft; committed at the end so backing out leaves nothing half-written.
  const [prayer, setPrayerDraft] = useState<SettingsDoc["prayer"]>(settings.prayer);
  const prayers = useMemo<Prayer[]>(() => (prayer.trackWitr ? [...FARD_PRAYERS, "witr"] : [...FARD_PRAYERS]), [prayer.trackWitr]);
  const [debt, setDebt] = useState<Record<Prayer, string>>({ fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "", witr: "" });
  const [wizard, setWizard] = useState(false);
  const [wStart, setWStart] = useState("");
  const [wEnd, setWEnd] = useState("");
  const [wExempt, setWExempt] = useState(0);
  const [template, setTemplate] = useState<string | null>(TEMPLATES[0].id);
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => prayers.reduce((s, p) => s + (Number(debt[p]) || 0), 0), [prayers, debt]);

  function applyWizard() {
    if (!wStart || !wEnd) return;
    const days = daysBetweenDates(wStart, wEnd);
    const months = days / 30.44;
    const perPrayer = Math.max(0, Math.round(days - months * wExempt));
    setDebt(Object.fromEntries(prayers.map((p) => [p, String(perPrayer)])) as Record<Prayer, string>);
    setWizard(false);
  }

  async function finish(withReminders: boolean) {
    setSaving(true);
    try {
      await patch((d) => ({ ...d, prayer, onboarded: true }));
      for (const p of prayers) {
        const n = Math.max(0, Math.trunc(Number(debt[p]) || 0));
        await append({ type: "debt.set_initial", payload: { v: 1, prayer: p, count: n } });
      }
      const t = TEMPLATES.find((x) => x.id === template);
      if (t) await append({ type: "strategy.started", payload: { v: 1, ...t.build(prayers) } });
      if (withReminders) {
        const r = await enablePush();
        if (r.ok) await patch((d) => ({ ...d, reminders: { ...d.reminders, enabled: true, perPrayer: Object.fromEntries(prayers.map((p) => [p, true])) } }));
        else toast({ message: "Reminders can be turned on later in Settings.", tone: "yellow" });
      }
      router.replace("/");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative flex flex-col gap-4">
      <Sticker kind="star" tone="coral" size={26} className="-right-1 top-2" rotate={15} />
      <Sticker kind="squiggle" tone="teal" size={26} className="left-0 top-[68px]" />

      <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <div key={s} className={`h-2.5 flex-1 rounded-full border-2 border-ink ${i <= step ? "bg-yellow" : "bg-paper"}`} />
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardTitle className="mb-1 text-[20px] font-black">Where do you pray?</CardTitle>
          <p className="mb-3 text-[13px] font-semibold text-mute">Prayer times give you windows: a prayer becomes pending when its window closes. You can skip this.</p>
          <LocationPicker value={prayer.location} onChange={(location) => setPrayerDraft((p) => ({ ...p, location }))} />
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardTitle className="mb-1 text-[20px] font-black">How do you calculate?</CardTitle>
          <p className="mb-3 text-[13px] font-semibold text-mute">QadaOS takes no position on fiqh. Every option here is yours to change later.</p>
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between gap-3 text-[13px] font-bold">
              Method
              <select className={selectCls} value={prayer.method} onChange={(e) => setPrayerDraft((p) => ({ ...p, method: e.target.value as SettingsDoc["prayer"]["method"] }))}>
                <option value="MuslimWorldLeague">Muslim World League</option>
                <option value="Egyptian">Egyptian</option>
                <option value="Karachi">Karachi</option>
                <option value="UmmAlQura">Umm al-Qura</option>
                <option value="Dubai">Dubai</option>
                <option value="MoonsightingCommittee">Moonsighting Committee</option>
                <option value="NorthAmerica">ISNA</option>
                <option value="Kuwait">Kuwait</option>
                <option value="Qatar">Qatar</option>
                <option value="Singapore">Singapore</option>
                <option value="Tehran">Tehran</option>
                <option value="Turkey">Turkey</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 text-[13px] font-bold">
              Asr
              <select className={selectCls} value={prayer.madhab} onChange={(e) => setPrayerDraft((p) => ({ ...p, madhab: e.target.value as "shafi" | "hanafi" }))}>
                <option value="shafi">Standard</option>
                <option value="hanafi">Hanafi (later)</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 text-[13px] font-bold">
              Track Witr as debt
              <input type="checkbox" className="h-6 w-6 accent-[var(--ink)]" checked={prayer.trackWitr} onChange={(e) => setPrayerDraft((p) => ({ ...p, trackWitr: e.target.checked }))} />
            </label>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardTitle className="mb-1 text-[20px] font-black">How many do you owe?</CardTitle>
          <p className="mb-3 text-[13px] font-semibold text-mute">An estimate is fine. You can adjust it later and the adjustment stays in your log. Many people round up.</p>
          {!wizard ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {prayers.map((p) => (
                  <label key={p} className="flex flex-col gap-1 text-[12px] font-bold">
                    {PRAYER_LABEL[p]}
                    <input id={`debt-${p}`} className={inputCls} inputMode="numeric" placeholder="0" value={debt[p]} onChange={(e) => setDebt((d) => ({ ...d, [p]: e.target.value.replace(/[^\d]/g, "") }))} />
                  </label>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Chip tone="yellow" className="num">
                  {fmtInt(total)} total
                </Chip>
                <button type="button" className="text-[12px] font-extrabold underline" onClick={() => setWizard(true)}>
                  Estimate from dates
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-[12px] font-bold">
                When did prayer become obligatory for you? (roughly)
                <input id="w-start" type="date" className={selectCls} value={wStart} onChange={(e) => setWStart(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-bold">
                When did you start praying consistently?
                <input id="w-end" type="date" className={selectCls} value={wEnd} onChange={(e) => setWEnd(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-bold">
                Days per month with no obligation (for example during menstruation)
                <select className={selectCls} value={wExempt} onChange={(e) => setWExempt(Number(e.target.value))}>
                  {[0, 3, 4, 5, 6, 7, 8, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {wStart && wEnd && (
                <Chip tone="yellow" className="num self-start">
                  about {fmtInt(Math.max(0, Math.round(daysBetweenDates(wStart, wEnd) - (daysBetweenDates(wStart, wEnd) / 30.44) * wExempt)))} of each prayer
                </Chip>
              )}
              <div className="flex gap-2">
                <Button block onClick={() => setWizard(false)}>
                  Back
                </Button>
                <Button block tone="yellow" disabled={!wStart || !wEnd} onClick={applyWizard}>
                  Use this
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardTitle className="mb-1 text-[20px] font-black">Pick a starting plan</CardTitle>
          <p className="mb-3 text-[13px] font-semibold text-mute">A plan is just a target generator. Switch whenever you like; your ledger never changes.</p>
          <div className="flex flex-col gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => setTemplate(t.id)} className={`brut pressable rounded-[12px] px-3.5 py-3 text-left ${template === t.id ? "bg-violet" : "bg-paper"}`}>
                <div className="text-[14px] font-extrabold">{t.name}</div>
                <div className="text-[12px] font-semibold">{t.description}</div>
              </button>
            ))}
            <button type="button" onClick={() => setTemplate(null)} className={`brut pressable rounded-[12px] px-3.5 py-3 text-left ${template === null ? "bg-violet" : "bg-paper"}`}>
              <div className="text-[14px] font-extrabold">No plan yet</div>
              <div className="text-[12px] font-semibold">Just track. Choose a plan later.</div>
            </button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardTitle className="mb-1 text-[20px] font-black">Reminders?</CardTitle>
          <p className="mb-3 text-[13px] font-semibold text-mute">A push at each prayer&apos;s start and one evening nudge to resolve pending prayers. Each is toggleable later.</p>
          {isIosNotInstalled() && (
            <div className="brut-sm mb-3 rounded-[10px] bg-yellow px-3 py-2 text-[12px] font-bold">On iPhone, reminders only work once QadaOS is on your Home Screen: tap Share, then Add to Home Screen. You can turn them on afterwards in Settings.</div>
          )}
          {!pushSupported() && <div className="brut-sm mb-3 rounded-[10px] bg-grey px-3 py-2 text-[12px] font-bold">This browser cannot receive push notifications.</div>}
          <div className="flex flex-col gap-2">
            <Button block tone="teal" size="lg" disabled={saving || !pushSupported() || isIosNotInstalled()} onClick={() => finish(true)}>
              Turn on reminders and finish
            </Button>
            <Button block size="lg" disabled={saving} onClick={() => finish(false)}>
              Finish without reminders
            </Button>
          </div>
        </Card>
      )}

      {step < 4 && (
        <div className="flex gap-2">
          {step > 0 && (
            <Button block onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          <Button block tone="yellow" onClick={() => setStep((s) => s + 1)} disabled={step === 2 && wizard}>
            {step === 0 && !prayer.location ? "Skip for now" : "Next"}
          </Button>
        </div>
      )}
    </div>
  );
}
