"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EstimateWizard } from "@/components/EstimateWizard";
import { Header } from "@/components/Header";
import { LocationPicker } from "@/components/LocationPicker";
import { Button, buttonClass } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { PageFoot, Sticker } from "@/components/ui/Sticker";
import { useToast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import { reestimateDeltas } from "@/domain/estimate";
import { localDateString } from "@/domain/prayerDay";
import type { SettingsDoc } from "@/domain/schemas";
import { FARD_PRAYERS, PRAYER_LABEL, type Prayer } from "@/domain/types";
import { addPasskey, signOut, useSession } from "@/lib/auth-client";
import { fmtInt } from "@/lib/format";
import { exportCsv, exportJson } from "@/lib/exportClient";
import { disablePush, enablePush, isIosNotInstalled, pushSupported } from "@/lib/pushClient";
import { useClientValue } from "@/lib/useClientValue";
import { getDb } from "@/store/db";
import { useLedger, useLedgerActions, useSettings, useSettingsActions } from "@/store/hooks";
import { useSyncState } from "@/store/syncManager";

const METHODS: { value: SettingsDoc["prayer"]["method"]; label: string }[] = [
  { value: "MuslimWorldLeague", label: "Muslim World League" },
  { value: "Egyptian", label: "Egyptian General Authority" },
  { value: "Karachi", label: "University of Karachi" },
  { value: "UmmAlQura", label: "Umm al-Qura (Makkah)" },
  { value: "Dubai", label: "Dubai" },
  { value: "MoonsightingCommittee", label: "Moonsighting Committee" },
  { value: "NorthAmerica", label: "ISNA (North America)" },
  { value: "Kuwait", label: "Kuwait" },
  { value: "Qatar", label: "Qatar" },
  { value: "Singapore", label: "Singapore" },
  { value: "Tehran", label: "Tehran" },
  { value: "Turkey", label: "Turkey (Diyanet)" },
];

const SECTIONS = [
  { id: "account", label: "Account" },
  { id: "prayer-times", label: "Prayer times" },
  { id: "reminders", label: "Reminders" },
  { id: "debt", label: "Debt" },
  { id: "display", label: "Display" },
  { id: "data", label: "Your data" },
];

/** Label and control share a top edge; the label column shrinks, the control never does. */
function Row({ label, children, hint, stacked = false }: { label: string; children: React.ReactNode; hint?: string; stacked?: boolean }) {
  return (
    <div className={`flex min-h-[44px] gap-3 border-t-2 border-ink py-2.5 first:border-t-0 ${stacked ? "flex-col" : "items-start justify-between"}`}>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-[15px] font-extrabold leading-tight">{label}</div>
        {hint && <div className="mt-0.5 text-[13px] font-semibold text-mute">{hint}</div>}
      </div>
      <div className={stacked ? "w-full" : "flex max-w-[58%] shrink-0 justify-end"}>{children}</div>
    </div>
  );
}

export function SettingsScreen() {
  const { settings } = useSettings();
  const { patch } = useSettingsActions();
  const { state, events } = useLedger();
  const { append, revoke } = useLedgerActions();
  const { data: session } = useSession();
  const sync = useSyncState();
  const toast = useToast();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [adjust, setAdjust] = useState<Prayer | null>(null);
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [reestimating, setReestimating] = useState(false);
  const prayers: Prayer[] = settings.prayer.trackWitr ? [...FARD_PRAYERS, "witr"] : [...FARD_PRAYERS];
  const canPush = useClientValue(pushSupported, false);

  const setPrayer = (p: Partial<SettingsDoc["prayer"]>) => patch((d) => ({ ...d, prayer: { ...d.prayer, ...p } }));
  const setReminders = (r: Partial<SettingsDoc["reminders"]>) => patch((d) => ({ ...d, reminders: { ...d.reminders, ...r } }));

  async function toggleReminders(on: boolean) {
    if (!on) {
      await setReminders({ enabled: false });
      await disablePush();
      toast({ message: "Reminders are off." });
      return;
    }
    if (isIosNotInstalled()) {
      toast({ message: "On iPhone, add QadaOS to your Home Screen first: Share, then Add to Home Screen. Reminders only work from there.", tone: "yellow", durationMs: 9000 });
      return;
    }
    const r = await enablePush();
    if (r.ok) {
      const all = Object.fromEntries(prayers.map((p) => [p, settings.reminders.perPrayer[p] ?? true]));
      await setReminders({ enabled: true, perPrayer: all });
      toast({ message: "Reminders are on.", tone: "teal" });
    } else {
      const msg = {
        unsupported: "This browser cannot receive notifications.",
        no_key: "Reminders are not set up on this server.",
        denied: "Notifications are blocked for this site. Allow them in your browser settings, then try again.",
        no_worker: "Reload the app once, then try again.",
        failed: "Could not turn reminders on. Check your connection and try again.",
      }[r.reason];
      toast({ message: msg, tone: "ink", durationMs: 7000 });
    }
  }

  async function setWitr(on: boolean) {
    await setPrayer({ trackWitr: on });
    toast({ message: on ? "Witr is now tracked. Set how many you owe under Debt below." : "Witr is no longer tracked. Your Witr entries are kept.", durationMs: 6000 });
  }

  async function setIshaEnd(v: "fajr" | "midnight") {
    await setPrayer({ ishaEnd: v });
    toast({ message: v === "midnight" ? "Isha now closes at midnight. Any pending prayers were recalculated." : "Isha now stays open until Fajr. Any pending prayers were recalculated.", durationMs: 6000 });
  }

  // People know what they owe, not the difference, so the sheet asks for the new total.
  const current = adjust ? Math.max(0, state.debt[adjust]) : 0;
  const n = target.trim() === "" ? 0 : Math.trunc(Number(target)) - current;

  async function saveAdjust() {
    if (!adjust) return;
    if (!n) return;
    const e = await append({ type: "debt.adjust", payload: { v: 1, prayer: adjust, delta: n, note: note.trim() || undefined } });
    toast({ message: `${PRAYER_LABEL[adjust]} adjusted by ${n > 0 ? "+" : "−"}${fmtInt(Math.abs(n))}.`, tone: "teal", action: { label: "Undo", onClick: () => revoke(e.id) } });
    setAdjust(null);
    setTarget("");
    setNote("");
  }

  const fard = prayers.filter((p) => p !== "witr");
  const todayIso = localDateString(new Date(), settings.prayer.location?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone);

  // A re-estimate is written as ordinary adjustments, so it shows in History and can be undone.
  async function applyReestimate(estimate: number) {
    const deltas = reestimateDeltas(fard, state.initial, state.adjustments, estimate);
    const ids: string[] = [];
    for (const d of deltas) {
      const e = await append({ type: "debt.adjust", payload: { v: 1, prayer: d.prayer, delta: d.delta, note: "Re-estimated from dates" } });
      ids.push(e.id);
    }
    setReestimating(false);
    toast(
      deltas.length === 0
        ? { message: "That matches your current estimate. Nothing changed." }
        : {
            message: `Estimate updated for ${deltas.length} ${deltas.length === 1 ? "prayer" : "prayers"}.`,
            tone: "teal",
            action: {
              label: "Undo",
              onClick: async () => {
                for (const id of ids) await revoke(id);
              },
            },
          },
    );
  }

  async function doSignOut() {
    await signOut();
    router.replace("/sign-in");
  }

  async function deleteAccount() {
    const res = await fetch("/api/account", { method: "DELETE", credentials: "same-origin" });
    if (!res.ok) {
      toast({ message: "Your account was not deleted. Check your connection and try again.", tone: "ink" });
      return;
    }
    await getDb().delete();
    await signOut();
    router.replace("/sign-in");
  }

  return (
    <>
      <Header title="Settings" sticker={<Sticker kind="square" tone="coral" size={16} rotate={12} inline />} />

      {/* Jump links stay in reach while the long page scrolls. Its own scroller, so the page never scrolls sideways. */}
      <nav aria-label="Settings sections" className="sticky top-[env(safe-area-inset-top,0px)] z-30 -mx-4 mb-3 overflow-x-auto border-b-[length:var(--bw)] border-ink bg-cream px-4 py-2 min-[900px]:mx-0 min-[900px]:px-0">
        <ul className="flex w-max gap-2 pr-4">
          {SECTIONS.map((sec) => (
            <li key={sec.id}>
              <a href={`#${sec.id}`} className={buttonClass({ size: "sm", variant: "flat" })}>
                {sec.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-4">
        <SectionCard id="account" title="Account">
          <Row label={session?.user.name ?? "Not signed in"} hint={session?.user.email ?? (process.env.NEXT_PUBLIC_AUTH_OPTIONAL === "true" ? "Local development mode" : "Sign in to sync across devices")}>
            {session ? (
              <Button size="sm" onClick={() => (sync.unsynced > 0 ? setLeaving(true) : void doSignOut())}>
                Sign out
              </Button>
            ) : (
              <Link href="/sign-in" className={buttonClass({ size: "sm", tone: "coral" })}>
                Sign in
              </Link>
            )}
          </Row>
          <Row label="Passkey" hint="Sign in with Face ID, Touch ID or your screen lock next time.">
            <Button size="sm" onClick={() => addPasskey("QadaOS").then((r) => toast(r?.error ? { message: "A passkey could not be added on this device.", tone: "ink" } : { message: "Passkey added.", tone: "teal" }))}>
              Add passkey
            </Button>
          </Row>
        </SectionCard>

        <SectionCard id="prayer-times" title="Prayer times">
          <div className="py-2.5">
            <LocationPicker key={settings.prayer.location ? `${settings.prayer.location.lat},${settings.prayer.location.lng}` : "none"} value={settings.prayer.location} onChange={(location) => setPrayer({ location })} />
          </div>
          <Row label="Calculation method" hint="If unsure, keep the default." stacked>
            <select aria-label="Calculation method" className="w-full" value={settings.prayer.method} onChange={(e) => setPrayer({ method: e.target.value as SettingsDoc["prayer"]["method"] })}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Asr time" hint="The Hanafi time begins later.">
            <select aria-label="Asr time" value={settings.prayer.madhab} onChange={(e) => setPrayer({ madhab: e.target.value as "shafi" | "hanafi" })}>
              <option value="shafi">Standard</option>
              <option value="hanafi">Hanafi</option>
            </select>
          </Row>
          <Row label="Isha ends" hint="Changes which prayers become pending at night.">
            <select aria-label="Isha ends" value={settings.prayer.ishaEnd} onChange={(e) => setIshaEnd(e.target.value as "fajr" | "midnight")}>
              <option value="fajr">At Fajr</option>
              <option value="midnight">At midnight</option>
            </select>
          </Row>
          <Row label="High latitudes" hint="Only matters far from the equator." stacked>
            <select aria-label="High latitude rule" className="w-full" value={settings.prayer.highLatitudeRule} onChange={(e) => setPrayer({ highLatitudeRule: e.target.value as SettingsDoc["prayer"]["highLatitudeRule"] })}>
              <option value="middleofthenight">Middle of the night</option>
              <option value="seventhofthenight">Seventh of the night</option>
              <option value="twilightangle">Twilight angle</option>
            </select>
          </Row>
          <Row label="Track Witr" hint="Adds Witr as a sixth prayer. Some schools require making it up.">
            <Toggle on={settings.prayer.trackWitr} onChange={setWitr} label="Track Witr" />
          </Row>
        </SectionCard>

        <SectionCard id="reminders" title="Reminders">
          <Row label="Notifications" hint={canPush ? "One at the start of each prayer, plus an evening review." : "This browser cannot receive notifications."}>
            <Toggle on={settings.reminders.enabled} onChange={toggleReminders} label="Notifications" disabled={!canPush} />
          </Row>
          {settings.reminders.enabled && (
            <>
              {prayers
                .filter((p) => p !== "witr")
                .map((p) => (
                  <Row key={p} label={PRAYER_LABEL[p]}>
                    <Toggle on={settings.reminders.perPrayer[p] ?? false} onChange={(v) => setReminders({ perPrayer: { ...settings.reminders.perPrayer, [p]: v } })} label={`${PRAYER_LABEL[p]} reminder`} />
                  </Row>
                ))}
              <Row label="Evening review" hint="A nudge to answer any pending prayers.">
                <Toggle on={settings.reminders.review} onChange={(v) => setReminders({ review: v })} label="Evening review" />
              </Row>
              <Row label="Review time" hint="After Isha begins.">
                <select aria-label="Review time after Isha" value={settings.reminders.reviewOffsetMinutes} onChange={(e) => setReminders({ reviewOffsetMinutes: Number(e.target.value) })}>
                  {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </select>
              </Row>
            </>
          )}
        </SectionCard>

        <SectionCard id="debt" title="Debt">
          {prayers.map((p) => (
            <Row key={p} label={PRAYER_LABEL[p]} hint={`${fmtInt(Math.max(0, state.debt[p]))} owed. Started at ${fmtInt(state.initial[p])}.`}>
              <Button
                size="sm"
                variant="flat"
                aria-label={`Adjust ${PRAYER_LABEL[p]}`}
                onClick={() => {
                  setTarget(String(Math.max(0, state.debt[p])));
                  setAdjust(p);
                }}
              >
                Adjust
              </Button>
            </Row>
          ))}
          <div className="border-t-2 border-ink py-2.5">
            <Button block variant="flat" onClick={() => setReestimating(true)}>
              Re-estimate from dates
            </Button>
            <p className="mt-2 text-[13px] font-semibold text-mute">Adjustments are added to your history, never hidden, and can be undone.</p>
          </div>
        </SectionCard>

        <SectionCard id="display" title="Display">
          <Row label="Hijri date" hint="Shift it if your local moon sighting differs.">
            <select aria-label="Hijri date offset" value={settings.display.hijriOffsetDays} onChange={(e) => patch((d) => ({ ...d, display: { ...d.display, hijriOffsetDays: Number(e.target.value) } }))}>
              {[-2, -1, 0, 1, 2].map((v) => (
                <option key={v} value={v}>
                  {v === 0 ? "No shift" : `${v > 0 ? "+" : "−"}${Math.abs(v)} day${Math.abs(v) === 1 ? "" : "s"}`}
                </option>
              ))}
            </select>
          </Row>
        </SectionCard>

        <SectionCard id="data" title="Your data" tone="pink">
          <Row label="Export everything" hint="Every entry and setting, as JSON. Works offline.">
            <Button
              size="sm"
              onClick={() => {
                exportJson(events, settings);
                toast({ message: "Export saved to your downloads.", tone: "teal" });
              }}
            >
              Export
            </Button>
          </Row>
          <Row label="Daily totals" hint="One row per day, as a spreadsheet file (CSV).">
            <Button
              size="sm"
              onClick={() => {
                exportCsv(events);
                toast({ message: "Daily totals saved to your downloads.", tone: "teal" });
              }}
            >
              Export
            </Button>
          </Row>
          <Row label="Delete account" hint="Removes everything from the server and this device. Export first if you want a copy.">
            <Button size="sm" tone="rust" onClick={() => setDeleting(true)}>
              Delete
            </Button>
          </Row>
        </SectionCard>

        <nav aria-label="About" className="flex flex-wrap items-center justify-center gap-2">
          <Link href="/privacy" className={buttonClass({ size: "sm", variant: "flat" })}>
            Privacy
          </Link>
          <a href="https://github.com/Ajelz/QadaOS" className={buttonClass({ size: "sm", variant: "flat" })} target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
          <span className="chip bg-cream">Version 0.2</span>
        </nav>
      </div>

      <PageFoot>
        <Sticker kind="tally" tone="orange" size={18} inline />
      </PageFoot>

      <Sheet
        open={Boolean(adjust)}
        onClose={() => setAdjust(null)}
        title={adjust ? `Adjust ${PRAYER_LABEL[adjust]}` : ""}
        footer={
          <Button block tone="coral" size="lg" disabled={!n} onClick={saveAdjust}>
            {n ? `Set to ${fmtInt(current + n)} (${n > 0 ? "+" : "−"}${fmtInt(Math.abs(n))})` : "No change"}
          </Button>
        }
      >
        {adjust && <p className="mb-3 text-[13px] font-semibold text-mute">You owe {fmtInt(current)} {PRAYER_LABEL[adjust]} now. If you have recounted, enter what you actually owe. The difference is added to your log and can be undone.</p>}
        <label className="mb-3 flex flex-col gap-1.5">
          <span className="text-[13px] font-black">What you owe</span>
          <input id="adjust-target" className="num w-full" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d]/g, "").slice(0, 6))} onFocus={(e) => e.target.select()} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-black">Note, if you like</span>
          <input id="adjust-note" className="w-full" maxLength={200} placeholder="Recounted my school years" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </Sheet>

      <Sheet open={reestimating} onClose={() => setReestimating(false)} title="Re-estimate from dates">
        <p className="mb-4 text-[13px] font-semibold text-mute">This recalculates the starting estimate for the five daily prayers. What you have logged since stays exactly as it is.</p>
        <EstimateWizard
          today={todayIso}
          useLabel="Update"
          onCancel={() => setReestimating(false)}
          onUse={applyReestimate}
          preview={(e) => {
            const deltas = reestimateDeltas(fard, state.initial, state.adjustments, e);
            return deltas.length === 0 ? (
              <>About {fmtInt(e)} of each prayer, which is what you already have.</>
            ) : (
              <>
                About {fmtInt(e)} of each prayer.
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {deltas.map((d) => (
                    <li key={d.prayer} className="num flex justify-between gap-3">
                      <span>{PRAYER_LABEL[d.prayer]}</span>
                      <span>
                        {fmtInt(d.from)} to {fmtInt(d.to)} ({d.delta > 0 ? "+" : "−"}
                        {fmtInt(Math.abs(d.delta))})
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            );
          }}
        />
      </Sheet>

      <Sheet
        open={leaving}
        onClose={() => setLeaving(false)}
        title="Sign out now?"
        footer={
          <div className="flex gap-3">
            <Button block onClick={() => setLeaving(false)}>
              Stay signed in
            </Button>
            <Button block tone="rust" onClick={doSignOut}>
              Sign out
            </Button>
          </div>
        }
      >
        <p className="text-[15px] font-bold">
          {sync.unsynced} {sync.unsynced === 1 ? "change has" : "changes have"} not synced yet. They stay on this device and will sync when you sign in again here, but they will not appear on your other devices until then.
        </p>
      </Sheet>

      <Sheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete your account"
        footer={
          <Button block tone="rust" size="lg" disabled={confirm !== "DELETE"} onClick={deleteAccount}>
            Delete everything
          </Button>
        }
      >
        <p className="mb-3 text-[15px] font-bold">This removes your ledger, settings and reminders from the server and from this device. It cannot be undone. Export first if you want a copy.</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-black">Type DELETE to confirm</span>
          <input id="delete-confirm" className="w-full" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoCapitalize="characters" />
        </label>
      </Sheet>
    </>
  );
}
