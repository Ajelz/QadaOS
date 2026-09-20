import { expect, test, type Page } from "@playwright/test";

/**
 * Not a test: regenerates the README screenshots from the real app.
 *
 *   README_SHOTS=1 npx playwright test e2e/readme-shots.spec.ts
 *
 * The app is driven through real onboarding, then three months of plausible history are
 * written straight into the local ledger so the charts have something to draw. The server
 * is stubbed as "signed in and synced", so no banner sits over the screens.
 */
test.skip(!process.env.README_SHOTS, "set README_SHOTS=1 to regenerate the README screenshots");

const OUT = "docs/media/shots";
const NOW = "2026-09-20T16:30:00+03:00";
const START = "2026-06-15";

async function stubServer(page: Page) {
  await page.route("**/api/auth/get-session", (r) =>
    r.fulfill({
      json: {
        session: { id: "s", userId: "u", expiresAt: "2030-01-01T00:00:00.000Z", token: "t" },
        user: { id: "u", name: "Sample", email: "sample@example.com", emailVerified: true, image: null },
      },
    }),
  );
  await page.route("**/api/sync/push", async (r) => {
    const body = r.request().postDataJSON() as { events: { id: string }[] };
    await r.fulfill({ json: { accepted: body.events.map((e, i) => ({ id: e.id, serverSeq: i + 1 })) } });
  });
  await page.route("**/api/sync/pull**", (r) => r.fulfill({ json: { events: [], cursor: 0 } }));
  await page.route("**/api/settings", (r) => r.fulfill({ json: r.request().method() === "GET" ? { doc: null, updatedAt: null } : { ok: true } }));
}

/** Three months of history, written into IndexedDB the same shape the app writes it. */
async function seedHistory(page: Page) {
  await page.evaluate(
    async ({ start, today }) => {
      const open = () =>
        new Promise<IDBDatabase>((res, rej) => {
          const q = indexedDB.open("qadaos");
          q.onsuccess = () => res(q.result);
          q.onerror = () => rej(q.error);
        });
      const db = await open();
      const all = await new Promise<Record<string, unknown>[]>((res) => {
        const q = db.transaction("events").objectStore("events").getAll();
        q.onsuccess = () => res(q.result as Record<string, unknown>[]);
      });
      const deviceId = all[0].deviceId as string;

      let seed = 20260920;
      const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
      const day = (d: string, n: number) => {
        const t = new Date(`${d}T12:00:00Z`);
        t.setUTCDate(t.getUTCDate() + n);
        return t.toISOString().slice(0, 10);
      };
      const base = (d: string, hhmm: string) => ({ id: crypto.randomUUID(), occurredAt: `${d}T${hhmm}:00.000+03:00`, tz: "Asia/Riyadh", deviceId, synced: 1 });

      const rows: Record<string, unknown>[] = [];
      // Setup happened three months ago, not today.
      all.forEach((e, i) => rows.push({ ...e, occurredAt: `${start}T09:${String(i).padStart(2, "0")}:00.000+03:00`, synced: 1 }));

      const prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
      const hours = { fajr: "05:10", dhuhr: "12:20", asr: "15:45", maghrib: "18:20", isha: "19:50" };
      for (let d = day(start, 1); d < today; d = day(d, 1)) {
        for (const p of prayers) {
          const r = rand();
          const status = r < 0.86 ? "on_time" : r < 0.95 ? "late" : "missed";
          rows.push({ ...base(d, hours[p]), type: "daily.resolved", payload: { v: 1, prayerDay: d, prayer: p, status } });
        }
        const r = rand();
        const count = r < 0.08 ? 0 : r < 0.2 ? 3 : r < 0.8 ? 5 : r < 0.93 ? 7 : 10;
        if (count > 0) rows.push({ ...base(d, "20:30"), type: "qada.logged", payload: { v: 1, prayer: "fajr", count, prayerDay: d } });
      }
      // Today so far: Fajr and Dhuhr prayed, the two Fajr that go with Fajr made up.
      rows.push({ ...base(today, "05:12"), type: "daily.resolved", payload: { v: 1, prayerDay: today, prayer: "fajr", status: "on_time" } });
      rows.push({ ...base(today, "05:25"), type: "qada.logged", payload: { v: 1, prayer: "fajr", count: 2, prayerDay: today } });
      rows.push({ ...base(today, "12:21"), type: "daily.resolved", payload: { v: 1, prayerDay: today, prayer: "dhuhr", status: "on_time" } });

      await new Promise<void>((res, rej) => {
        const tx = db.transaction("events", "readwrite");
        rows.forEach((r) => tx.objectStore("events").put(r));
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { start: START, today: NOW.slice(0, 10) },
  );
}

async function onboard(page: Page) {
  await page.clock.install({ time: new Date(NOW) });
  await stubServer(page);
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Enter coordinates instead" }).click();
  await page.locator("#loc-lat").fill("24.7136");
  await page.locator("#loc-lng").fill("46.6753");
  await page.locator("#loc-tz").fill("Asia/Riyadh");
  await page.locator("#loc-apply").click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  for (const p of ["fajr", "dhuhr", "asr", "maghrib", "isha"]) await page.locator(`#debt-${p}`).fill("4000");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("radio", { name: /Fajr first/ }).click();
}

async function finish(page: Page) {
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: /^Finish( without reminders)?$/ }).click();
  await expect(page.getByText("Prayers owed")).toBeVisible();
  await seedHistory(page);
}

async function shot(page: Page, route: string, name: string) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test("phone screenshots", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, timezoneId: "Asia/Riyadh" });
  const page = await ctx.newPage();
  await onboard(page);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/onboarding-plan.png` });
  await finish(page);

  await shot(page, "/", "today");
  await page.getByRole("button", { name: "Log qada" }).last().click();
  await expect(page.getByRole("dialog", { name: "Log qada" })).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/log-qada.png` });
  await page.keyboard.press("Escape");

  await shot(page, "/plan", "plan");
  await shot(page, "/stats", "stats");
  await shot(page, "/log", "history");
  await ctx.close();
});

test("desktop screenshot", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, timezoneId: "Asia/Riyadh" });
  const page = await ctx.newPage();
  await onboard(page);
  await finish(page);
  await shot(page, "/", "desktop-today");
  await ctx.close();
});

test("hero art", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 840 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  await page.goto(`file://${process.cwd()}/docs/media/src/hero.html`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "docs/media/hero.png" });
  await ctx.close();
});
