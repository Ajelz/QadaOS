"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LocationPicker } from "@/components/LocationPicker";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { PageFoot, Sticker } from "@/components/ui/Sticker";
import { useToast } from "@/components/ui/Toast";
import { localDateString } from "@/domain/prayerDay";
import { SettingsDocSchema, type SettingsDoc } from "@/domain/schemas";
import { simulateFinish, TEMPLATES } from "@/domain/strategy";
import { FARD_PRAYERS, perPrayer, PRAYER_LABEL, type Prayer } from "@/domain/types";
import { fmtInt, fmtMonth, fmtRelativeDays } from "@/lib/format";
import { enablePush, isIosNotInstalled, pushSupported } from "@/lib/pushClient";
import { useClientValue } from "@/lib/useClientValue";
import { useLedger, useLedgerActions, useSettings, useSettingsActions } from "@/store/hooks";

const STEPS = ["Where you pray", "How you calculate", "What you owe", "Your plan", "Reminders"] as const;
const DRAFT_KEY = "qadaos:onboarding-draft:v1";

interface Draft {
  step: number;
  prayer: SettingsDoc["prayer"];
  debt: Record<Prayer, string>;
  template: string | null;
}

function loadDraft(fallback: SettingsDoc["prayer"]): Draft {
  const empty: Draft = { step: 0, prayer: fallback, debt: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "", witr: "" }, template: TEMPLATES[0].id };
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return empty;
    const d = JSON.parse(raw) as Partial<Draft>;
    const prayer = SettingsDocSchema.shape.prayer.safeParse(d.prayer);
    return { step: Math.min(4, Math.max(0, Number(d.step) || 0)), prayer: prayer.success ? prayer.data : fallback, debt: { ...empty.debt, ...(d.debt ?? {}) }, template: d.template === null ? null : (d.template ?? empty.template) };
  } catch {
    return empty;
  }
}

function daysBetweenDates(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

/** The draft lives in localStorage, so the flow only mounts on the client, after it can be read. */
export function OnboardingScreen() {
  const mounted = useClientValue(() => true, false);
  const { settings, ready } = useSettings();
  const { state, ready: ledgerReady } = useLedger();
  const router = useRouter();
  const [rerun, setRerun] = useState(false);
  if (!mounted || !ready || !ledgerReady) return <div aria-busy="true" className="min-h-[60vh]" />;

  // Running setup again would write a second starting balance over the first. Ask first.
  const existing = Object.values(state.initial).reduce((a, b) => a + b, 0);
  if (existing > 0 && !rerun) {
    return (
      <div className="my-auto flex flex-col gap-4">
        <h1 className="display text-[28px]">Set up again?</h1>
        <Card>
          <p className="text-[15px] font-bold">You already have a starting balance of {fmtInt(existing)} prayers. Running setup again replaces it and starts a new plan. Everything you have logged stays in your ledger.</p>
          <p className="mt-2 text-[13px] font-semibold text-mute">To correct a single number instead, use Adjust under Debt in Settings.</p>
        </Card>
        <Button block tone="coral" size="lg" onClick={() => router.replace("/")}>
          Keep my ledger as it is
        </Button>
        <Button block variant="flat" onClick={() => setRerun(true)}>
          Run setup again
        </Button>
      </div>
    );
  }
  return <Flow initialPrayer={settings.prayer} />;
}

function Flow({ initialPrayer }: { initialPrayer: SettingsDoc["prayer"] }) {
  const router = useRouter();
  const toast = useToast();
  const { patch } = useSettingsActions();
  const { append } = useLedgerActions();

  const [draft, setDraft] = useState<Draft>(() => loadDraft(initialPrayer));
  const { step, prayer, debt, template } = draft;
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const [wizard, setWizard] = useState(false);
  const [wStart, setWStart] = useState("");
  const [wEnd, setWEnd] = useState("");
  const [wExempt, setWExempt] = useState(0);
  const [same, setSame] = useState("");
  const [saving, setSaving] = useState(false);

  // Persist on every change so a reload, or a trip to another app, resumes where you were.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage can be unavailable (private mode); the flow still works for this session.
    }
  }, [draft]);

  const prayers = useMemo<Prayer[]>(() => (prayer.trackWitr ? [...FARD_PRAYERS, "witr"] : [...FARD_PRAYERS]), [prayer.trackWitr]);
  const counts = useMemo(() => perPrayer((p) => (prayers.includes(p) ? Math.max(0, Math.trunc(Number(debt[p]) || 0)) : 0)), [prayers, debt]);
  const total = prayers.reduce((s, p) => s + counts[p], 0);
  const today = localDateString(new Date(), prayer.location?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const chosen = TEMPLATES.find((t) => t.id === template);
  const chosenFinish = chosen ? simulateFinish(counts, chosen.build(prayers), today) : undefined;
  const wizardReversed = Boolean(wStart && wEnd && wEnd < wStart);
  const wizardEstimate = wStart && wEnd && !wizardReversed ? Math.max(0, Math.round(daysBetweenDates(wStart, wEnd) - (daysBetweenDates(wStart, wEnd) / 30.44) * wExempt)) : null;
  // Witr is not missed on the same basis as the five, so the estimate never fills it.
  const fard = prayers.filter((p) => p !== "witr");
  const wouldReplace = fard.some((p) => debt[p] !== "");

  function fillAll(value: string) {
    set({ debt: { ...debt, ...(Object.fromEntries(fard.map((p) => [p, value])) as Record<Prayer, string>) } });
  }

  function applyWizard() {
    if (wizardEstimate === null) return;
    fillAll(String(wizardEstimate));
    setSame(String(wizardEstimate));
    setWizard(false);
  }

  const pushFailure: Record<string, string> = {
    unsupported: "This browser cannot receive notifications.",
    no_key: "Reminders are not set up on this server.",
    denied: "Notifications are blocked for this site. Allow them in your browser settings, then turn reminders on in Settings.",
    no_worker: "Reminders need one reload first. Turn them on in Settings.",
    failed: "Reminders could not be turned on. Try again in Settings.",
  };

  async function finish(withReminders: boolean) {
    setSaving(true);
    try {
      await patch((d) => ({ ...d, prayer, onboarded: true }));
      for (const p of prayers) await append({ type: "debt.set_initial", payload: { v: 1, prayer: p, count: counts[p] } });
      if (chosen) await append({ type: "strategy.started", payload: { v: 1, ...chosen.build(prayers) } });
      if (withReminders) {
        const r = await enablePush();
        if (r.ok) await patch((d) => ({ ...d, reminders: { ...d.reminders, enabled: true, perPrayer: Object.fromEntries(prayers.map((p) => [p, true])) } }));
        else toast({ message: pushFailure[r.reason], tone: "yellow", durationMs: 8000 });
      }
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      router.replace("/");
    } finally {
      setSaving(false);
    }
  }

  const iosBlocked = isIosNotInstalled();
  const canPush = pushSupported();

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="sr-only">Set up QadaOS</h1>
      <div className="mb-3 w-fit rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-coral px-2 py-0.5" style={{ boxShadow: "var(--shadow-sm)" }} aria-hidden>
        <span className="display text-[17px]">QadaOS</span>
      </div>
      {/* Progress: pinned to the top, with the sticker in its own reserved space. */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 text-[13px] font-extrabold" aria-live="polite">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </div>
          <div className="flex items-center gap-1.5" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
            {STEPS.map((s, i) => (
              <div key={s} className={`h-3 flex-1 rounded-full border-[length:var(--bw)] border-ink ${i <= step ? "bg-coral" : "bg-paper"}`} />
            ))}
          </div>
        </div>
        <Sticker kind="star" tone="yellow" size={28} rotate={12} inline />
      </div>

      {/* Content sits in the middle of tall screens instead of being stranded at the top. */}
      <div className="flex flex-1 flex-col justify-center gap-4 py-5">
        {step === 0 && (
          <Card>
            <CardTitle className="mb-1 text-[20px]">Where do you pray?</CardTitle>
            <p className="mb-3 text-[13px] font-semibold text-mute">Your location gives QadaOS your prayer times, so it can show what is due now and ask you about any prayer you did not record. You can skip this and add it later.</p>
            <LocationPicker key={prayer.location ? `${prayer.location.lat},${prayer.location.lng}` : "none"} value={prayer.location} onChange={(location) => set({ prayer: { ...prayer, location } })} />
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardTitle className="mb-1 text-[20px]">How do you calculate?</CardTitle>
            <p className="mb-3 text-[13px] font-semibold text-mute">QadaOS takes no position between schools. If you are unsure, keep these defaults. Everything here can be changed later in Settings.</p>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-black">Prayer time method</span>
                <select className="w-full" value={prayer.method} onChange={(e) => set({ prayer: { ...prayer, method: e.target.value as SettingsDoc["prayer"]["method"] } })}>
                  <option value="MuslimWorldLeague">Muslim World League</option>
                  <option value="Egyptian">Egyptian General Authority</option>
                  <option value="Karachi">University of Karachi</option>
                  <option value="UmmAlQura">Umm al-Qura (Makkah)</option>
                  <option value="Dubai">Dubai</option>
                  <option value="MoonsightingCommittee">Moonsighting Committee</option>
                  <option value="NorthAmerica">ISNA (North America)</option>
                  <option value="Kuwait">Kuwait</option>
                  <option value="Qatar">Qatar</option>
                  <option value="Singapore">Singapore</option>
                  <option value="Tehran">Tehran</option>
                  <option value="Turkey">Turkey (Diyanet)</option>
                </select>
                <span className="text-[13px] font-semibold text-mute">Usually the one your local mosque or prayer app uses.</span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-black">Asr time</span>
                <select className="w-full" value={prayer.madhab} onChange={(e) => set({ prayer: { ...prayer, madhab: e.target.value as "shafi" | "hanafi" } })}>
                  <option value="shafi">Standard</option>
                  <option value="hanafi">Hanafi (begins later)</option>
                </select>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={prayer.trackWitr} onChange={(e) => set({ prayer: { ...prayer, trackWitr: e.target.checked } })} />
                <span>
                  <span className="block text-[15px] font-extrabold">Also track Witr</span>
                  <span className="block text-[13px] font-semibold text-mute">Some schools require making up missed Witr. Leave this off if unsure.</span>
                </span>
              </label>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardTitle className="mb-1 text-[20px]">How many do you owe?</CardTitle>
            {!wizard ? (
              <>
                <p className="mb-3 text-[13px] font-semibold text-mute">A rough number is fine. You can adjust it later and the change is kept in your log. Many people round up to be safe.</p>
                <label className="mb-3 flex flex-col gap-1.5">
                  <span className="text-[13px] font-black">Same number for each of the five</span>
                  <input
                    id="debt-same"
                    className="num w-full"
                    inputMode="numeric"
                    placeholder="For example 4000"
                    value={same}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, "").slice(0, 6);
                      setSame(v);
                      fillAll(v);
                    }}
                  />
                  <span className="text-[13px] font-semibold text-mute">Most people missed whole days, so the five are usually equal. Edit any one below.</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {prayers.map((p) => (
                    <label key={p} className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-[13px] font-black">{PRAYER_LABEL[p]}</span>
                      <input id={`debt-${p}`} className="num w-full" inputMode="numeric" placeholder="0" value={debt[p]} onChange={(e) => set({ debt: { ...debt, [p]: e.target.value.replace(/[^\d]/g, "").slice(0, 6) } })} />
                    </label>
                  ))}
                  <div className={`flex min-w-0 flex-col justify-end ${prayers.length % 2 === 0 ? "col-span-2" : ""}`}>
                    <Button variant="flat" size="sm" className="w-full" onClick={() => setWizard(true)}>
                      Estimate from dates
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-[13px] font-extrabold">Total</span>
                  <Chip tone="orange" className="num text-[13px]">
                    {fmtInt(total)} {total === 1 ? "prayer" : "prayers"}
                  </Chip>
                </div>
                {total >= 1000 && <p className="mt-3 rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-cream px-3 py-2 text-[13px] font-bold">{fmtInt(total)} is a number, not a verdict. The next step turns it into a few prayers a day.</p>}
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-[13px] font-semibold text-mute">Two dates give a starting estimate. It fills in every prayer with the same number, which you can then edit.</p>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-black">Roughly when did prayer become obligatory for you?</span>
                  <input id="w-start" type="date" className="w-full" value={wStart} max={today} onChange={(e) => setWStart(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-black">When did you begin praying regularly?</span>
                  <input id="w-end" type="date" className="w-full" value={wEnd} min={wStart || undefined} max={today} onChange={(e) => setWEnd(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-black">Days each month with no obligation</span>
                  <select className="w-full" value={wExempt} onChange={(e) => setWExempt(Number(e.target.value))}>
                    {[0, 3, 4, 5, 6, 7, 8, 10].map((v) => (
                      <option key={v} value={v}>
                        {v === 0 ? "None" : `${v} days`}
                      </option>
                    ))}
                  </select>
                  <span className="text-[13px] font-semibold text-mute">For example during menstruation. Leave at none if this does not apply to you.</span>
                </label>
                {wizardReversed && (
                  <p role="alert" className="rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-ink px-3 py-2 text-[13px] font-bold text-cream">
                    The second date has to come after the first.
                  </p>
                )}
                {wizardEstimate !== null && (
                  <p className="rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-orange px-3 py-2 text-[13px] font-bold">
                    About {fmtInt(wizardEstimate)} of each prayer, {fmtInt(wizardEstimate * fard.length)} in total.{wouldReplace ? " This replaces the numbers you typed for the five daily prayers." : ""}
                  </p>
                )}
                <div className="flex gap-3">
                  <Button block onClick={() => setWizard(false)}>
                    Cancel
                  </Button>
                  <Button block tone="coral" disabled={wizardEstimate === null} onClick={applyWizard}>
                    Use this estimate
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardTitle className="mb-1 text-[20px]">Pick a starting plan</CardTitle>
            <p className="mb-3 text-[13px] font-semibold text-mute">A plan turns what you owe into a few prayers a day. Each date shows when you would finish if you met it every day. Switch whenever you like: nothing you have logged changes.</p>
            <div className="flex flex-col gap-3" role="radiogroup" aria-label="Starting plan">
              {TEMPLATES.map((t) => {
                const f = simulateFinish(counts, t.build(prayers), today);
                const on = template === t.id;
                return (
                  <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => set({ template: t.id })} className={`pressable rounded-[var(--r-btn)] border-[length:var(--bw)] border-ink px-4 py-3 text-left ${on ? "bg-violet" : "bg-paper"}`} style={{ boxShadow: on ? "none" : "var(--shadow)", transform: on ? "translate(2px, 2px)" : undefined }}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-[15px] font-black">
                        {on && <Icon name="check" size={16} strokeWidth={3.5} />}
                        {t.name}
                      </span>
                      {f && f.days > 0 && <Chip className="num">{fmtMonth(f.finishDay)}</Chip>}
                    </div>
                    <div className="mt-1 text-[13px] font-semibold">
                      {t.description}
                      {f && f.days > 0 ? ` About ${fmtRelativeDays(f.days)}.` : ""}
                    </div>
                  </button>
                );
              })}
              <button type="button" role="radio" aria-checked={template === null} onClick={() => set({ template: null })} className={`pressable rounded-[var(--r-btn)] border-[length:var(--bw)] border-ink px-4 py-3 text-left ${template === null ? "bg-violet" : "bg-paper"}`} style={{ boxShadow: template === null ? "none" : "var(--shadow)", transform: template === null ? "translate(2px, 2px)" : undefined }}>
                <div className="text-[15px] font-black">No plan for now</div>
                <div className="mt-1 text-[13px] font-semibold">Just keep the ledger. Choose a plan later from the Plan tab.</div>
              </button>
            </div>
          </Card>
        )}

        {step === 4 && (
          <>
            <Card tone="orange">
              <CardTitle className="mb-2">Your setup</CardTitle>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px] font-bold">
                <dt>You owe</dt>
                <dd className="num text-right font-black">{fmtInt(total)} prayers</dd>
                <dt>Prayer times</dt>
                <dd className="truncate text-right font-black">{prayer.location?.label ?? "Not set"}</dd>
                <dt>Plan</dt>
                <dd className="truncate text-right font-black">{chosen?.name ?? "None yet"}</dd>
                {chosenFinish && chosenFinish.days > 0 && (
                  <>
                    <dt>Finish, if you meet it</dt>
                    <dd className="num text-right font-black">{fmtMonth(chosenFinish.finishDay)}</dd>
                  </>
                )}
              </dl>
            </Card>
            <Card>
              <CardTitle className="mb-1 text-[20px]">Want reminders?</CardTitle>
              <p className="mb-3 text-[13px] font-semibold text-mute">One notification at the start of each prayer, and one in the evening if any prayer still needs an answer. You can switch each one off later.</p>
              {iosBlocked && <p className="mb-3 rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-yellow px-3 py-2 text-[13px] font-bold">On iPhone, reminders only work once QadaOS is on your Home Screen. Finish now, then tap Share and Add to Home Screen, and turn reminders on in Settings.</p>}
              {!canPush && !iosBlocked && <p className="mb-3 rounded-[var(--r-sm)] border-[length:var(--bw)] border-ink bg-grey px-3 py-2 text-[13px] font-bold">This browser cannot receive notifications.</p>}
              <div className="flex flex-col gap-3">
                {canPush && !iosBlocked && (
                  <Button block tone="coral" size="lg" disabled={saving} onClick={() => finish(true)}>
                    Finish and turn on reminders
                  </Button>
                )}
                <Button block size="lg" tone={canPush && !iosBlocked ? "paper" : "coral"} disabled={saving} onClick={() => finish(false)}>
                  {canPush && !iosBlocked ? "Finish without reminders" : "Finish"}
                </Button>
              </div>
            </Card>
          </>
        )}

        {!wizard && (
          <div className="flex gap-3">
            {step > 0 && (
              <Button block disabled={saving} onClick={() => set({ step: step - 1 })}>
                Back
              </Button>
            )}
            {step < 4 &&
              (step === 0 && !prayer.location ? (
                // Skipping is allowed, but it is not the recommended path, so it is not the loud button.
                <Button block variant="flat" onClick={() => set({ step: step + 1 })}>
                  Set this later
                </Button>
              ) : (
                <Button block tone="coral" onClick={() => set({ step: step + 1 })}>
                  Next
                </Button>
              ))}
          </div>
        )}
      </div>

      <PageFoot>
        <Sticker kind="squiggle" tone="teal" size={20} inline />
        <Sticker kind="dot" tone="violet" size={16} inline />
      </PageFoot>
    </div>
  );
}
