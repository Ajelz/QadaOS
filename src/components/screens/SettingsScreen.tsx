"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocationPicker } from "@/components/LocationPicker";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import type { SettingsDoc } from "@/domain/schemas";
import { FARD_PRAYERS, PRAYER_LABEL, type Prayer } from "@/domain/types";
import { addPasskey, signOut, useSession } from "@/lib/auth-client";
import { fmtInt } from "@/lib/format";
import { disablePush, enablePush, isIosNotInstalled, pushSupported } from "@/lib/pushClient";
import { useClientValue } from "@/lib/useClientValue";
import { getDb } from "@/store/db";
import { useLedger, useLedgerActions, useSettings, useSettingsActions } from "@/store/hooks";

const selectCls = "brut-sm rounded-[8px] bg-paper px-2.5 py-2 text-[13px] font-bold";

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

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <div className="text-[13px] font-bold">{label}</div>
        {hint && <div className="text-[11px] font-semibold text-mute">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`brut-sm pressable relative h-8 w-14 rounded-full ${on ? "bg-teal" : "bg-paper"}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full border-2 border-ink bg-paper transition-[left] ${on ? "left-7" : "left-1"}`} />
    </button>
  );
}

export function SettingsScreen() {
  const { settings } = useSettings();
  const { patch } = useSettingsActions();
  const { state } = useLedger();
  const { append } = useLedgerActions();
  const { data: session } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [adjust, setAdjust] = useState<Prayer | null>(null);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const prayers: Prayer[] = settings.prayer.trackWitr ? [...FARD_PRAYERS, "witr"] : [...FARD_PRAYERS];
  const canPush = useClientValue(pushSupported, false);

  const setPrayer = (p: Partial<SettingsDoc["prayer"]>) => patch((d) => ({ ...d, prayer: { ...d.prayer, ...p } }));
  const setReminders = (r: Partial<SettingsDoc["reminders"]>) => patch((d) => ({ ...d, reminders: { ...d.reminders, ...r } }));

  async function toggleReminders(on: boolean) {
    if (!on) {
      await setReminders({ enabled: false });
      await disablePush();
      return;
    }
    if (isIosNotInstalled()) {
      toast({ message: "On iPhone, add QadaOS to your Home Screen first. Reminders only work when installed.", tone: "yellow", durationMs: 7000 });
      return;
    }
    const r = await enablePush();
    if (r.ok) {
      const all = Object.fromEntries(prayers.map((p) => [p, settings.reminders.perPrayer[p] ?? true]));
      await setReminders({ enabled: true, perPrayer: all });
      toast({ message: "Reminders on.", tone: "teal" });
    } else {
      const msg = {
        unsupported: "This browser cannot receive push notifications.",
        no_key: "This deployment has no push keys configured.",
        denied: "Notifications are blocked. Allow them in your browser settings.",
        no_worker: "Reload the app once and try again.",
        failed: "Could not subscribe. Try again in a moment.",
      }[r.reason];
      toast({ message: msg, tone: "coral", durationMs: 6000 });
    }
  }

  async function saveAdjust() {
    if (!adjust) return;
    const n = Math.trunc(Number(delta));
    if (!n) return;
    await append({ type: "debt.adjust", payload: { v: 1, prayer: adjust, delta: n, note: note.trim() || undefined } });
    toast({ message: `${PRAYER_LABEL[adjust]} adjusted by ${n > 0 ? "+" : ""}${n}.`, tone: "teal" });
    setAdjust(null);
    setDelta("");
    setNote("");
  }

  async function deleteAccount() {
    const res = await fetch("/api/account", { method: "DELETE", credentials: "same-origin" });
    if (!res.ok) {
      toast({ message: "Deletion failed. Check your connection and try again.", tone: "coral" });
      return;
    }
    await getDb().delete();
    await signOut();
    router.replace("/sign-in");
  }

  return (
    <>
      <header className="mb-3 flex items-center gap-3 px-0.5">
        <Link href="/" aria-label="Back to Today" className="brut-sm pressable grid h-10 w-10 place-items-center rounded-[10px] text-[18px] font-black">
          ←
        </Link>
        <h1 className="display text-[28px]">Settings</h1>
      </header>

      <div className="flex flex-col gap-3">
        <Card>
          <CardTitle>Account</CardTitle>
          <Row label={session?.user.name ?? "Signed in"} hint={session?.user.email ?? (process.env.NEXT_PUBLIC_AUTH_OPTIONAL === "true" ? "auth optional (dev)" : "session unavailable")}>
            <Button size="sm" onClick={() => signOut().then(() => router.replace("/sign-in"))}>
              Sign out
            </Button>
          </Row>
          <Row label="Passkey" hint="Sign in with Face ID or Touch ID next time">
            <Button
              size="sm"
              tone="teal"
              onClick={() =>
                addPasskey("QadaOS").then((r) => toast(r?.error ? { message: "Could not add a passkey here.", tone: "coral" } : { message: "Passkey added.", tone: "teal" }))
              }
            >
              Add passkey
            </Button>
          </Row>
        </Card>

        <Card>
          <CardTitle className="mb-1">Prayer times</CardTitle>
          <LocationPicker value={settings.prayer.location} onChange={(location) => setPrayer({ location })} />
          <Row label="Calculation method">
            <select className={selectCls} value={settings.prayer.method} onChange={(e) => setPrayer({ method: e.target.value as SettingsDoc["prayer"]["method"] })}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Asr" hint="Hanafi begins later">
            <select className={selectCls} value={settings.prayer.madhab} onChange={(e) => setPrayer({ madhab: e.target.value as "shafi" | "hanafi" })}>
              <option value="shafi">Standard</option>
              <option value="hanafi">Hanafi</option>
            </select>
          </Row>
          <Row label="Isha window ends">
            <select className={selectCls} value={settings.prayer.ishaEnd} onChange={(e) => setPrayer({ ishaEnd: e.target.value as "fajr" | "midnight" })}>
              <option value="fajr">At Fajr</option>
              <option value="midnight">Islamic midnight</option>
            </select>
          </Row>
          <Row label="High latitudes">
            <select className={selectCls} value={settings.prayer.highLatitudeRule} onChange={(e) => setPrayer({ highLatitudeRule: e.target.value as SettingsDoc["prayer"]["highLatitudeRule"] })}>
              <option value="middleofthenight">Middle of the night</option>
              <option value="seventhofthenight">Seventh of the night</option>
              <option value="twilightangle">Twilight angle</option>
            </select>
          </Row>
          <Row label="Track Witr" hint="Adds a sixth column, as some schools require">
            <Toggle on={settings.prayer.trackWitr} onChange={(v) => setPrayer({ trackWitr: v })} label="Track Witr" />
          </Row>
        </Card>

        <Card>
          <CardTitle>Reminders</CardTitle>
          <Row label="Push notifications" hint={canPush ? "At each prayer's start, plus an evening review" : "Not supported in this browser"}>
            <Toggle on={settings.reminders.enabled} onChange={toggleReminders} label="Push notifications" />
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
              <Row label="Evening review" hint={`${settings.reminders.reviewOffsetMinutes} minutes after Isha begins`}>
                <Toggle on={settings.reminders.review} onChange={(v) => setReminders({ review: v })} label="Evening review" />
              </Row>
              <Row label="Review delay">
                <select className={selectCls} value={settings.reminders.reviewOffsetMinutes} onChange={(e) => setReminders({ reviewOffsetMinutes: Number(e.target.value) })}>
                  {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </Row>
            </>
          )}
        </Card>

        <Card>
          <CardTitle>Debt</CardTitle>
          {prayers.map((p) => (
            <Row key={p} label={PRAYER_LABEL[p]} hint={`${fmtInt(Math.max(0, state.debt[p]))} owed · started at ${fmtInt(state.initial[p])}`}>
              <Button size="sm" onClick={() => setAdjust(p)}>
                Adjust
              </Button>
            </Row>
          ))}
          <p className="mt-1 text-[11px] font-semibold text-mute">Adjustments are logged, never hidden. Your original estimate stays in the log.</p>
        </Card>

        <Card>
          <CardTitle>Display</CardTitle>
          <Row label="Hijri date offset" hint="If your local moon sighting differs">
            <select className={selectCls} value={settings.display.hijriOffsetDays} onChange={(e) => patch((d) => ({ ...d, display: { ...d.display, hijriOffsetDays: Number(e.target.value) } }))}>
              {[-2, -1, 0, 1, 2].map((n) => (
                <option key={n} value={n}>
                  {n > 0 ? `+${n}` : n} day{Math.abs(n) === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </Row>
        </Card>

        <Card>
          <CardTitle>Data</CardTitle>
          <Row label="Export everything" hint="A JSON file of all your events and settings">
            <a href="/api/account/export" className="brut pressable rounded-[10px] bg-paper px-3 py-2 text-[13px] font-extrabold" download>
              Export
            </a>
          </Row>
          <Row label="Delete account" hint="Removes everything, immediately">
            <Button size="sm" tone="coral" onClick={() => setDeleting(true)}>
              Delete
            </Button>
          </Row>
        </Card>

        <div className="flex flex-wrap items-center justify-center gap-3 py-2 text-[12px] font-bold">
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
          <a href="https://github.com/Ajelz/QadaOS" className="underline" target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
          <Chip tone="grey">v0.1</Chip>
        </div>
      </div>

      <Sheet open={Boolean(adjust)} onClose={() => setAdjust(null)} title={adjust ? `Adjust ${PRAYER_LABEL[adjust]}` : ""}>
        <label className="mb-2 flex flex-col gap-1 text-[12px] font-bold">
          Change (use a minus sign to reduce)
          <input id="adjust-delta" className="brut-sm num rounded-[8px] px-2.5 py-2 text-[16px] font-extrabold" inputMode="numeric" placeholder="+200 or -50" value={delta} onChange={(e) => setDelta(e.target.value)} />
        </label>
        <label className="mb-3 flex flex-col gap-1 text-[12px] font-bold">
          Note (optional)
          <input id="adjust-note" className="brut-sm rounded-[8px] px-2.5 py-2 text-[13px] font-bold" maxLength={200} placeholder="Recounted my school years" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <Button block tone="violet" size="lg" disabled={!Math.trunc(Number(delta))} onClick={saveAdjust}>
          Apply adjustment
        </Button>
      </Sheet>

      <Sheet open={deleting} onClose={() => setDeleting(false)} title="Delete your account">
        <p className="mb-3 text-[13px] font-semibold">This removes your ledger, settings and reminders from the server and this device. There is no undo. Export first if you want a copy.</p>
        <label className="mb-3 flex flex-col gap-1 text-[12px] font-bold">
          Type DELETE to confirm
          <input id="delete-confirm" className="brut-sm rounded-[8px] px-2.5 py-2 text-[14px] font-extrabold" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </label>
        <Button block tone="coral" size="lg" disabled={confirm !== "DELETE"} onClick={deleteAccount}>
          Delete everything
        </Button>
      </Sheet>
    </>
  );
}
