import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Regression tests for the UI critique: things that are easy to break and hard to notice.
 * Fixed clock and location so prayer windows are deterministic:
 * 16:30 in Riyadh: Asr is the current window, and Fajr and Dhuhr have closed unanswered.
 */
const SHOTS = "e2e/screenshots";
const ROUTES = ["/", "/log", "/plan", "/stats", "/settings", "/privacy", "/sign-in", "/~offline", "/nope"];

async function seeded(browser: Browser, viewport: { width: number; height: number }, opts: { witr?: boolean } = {}): Promise<Page> {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: viewport.width < 700, hasTouch: viewport.width < 700, timezoneId: "Asia/Riyadh" });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date("2026-09-20T16:30:00+03:00") });
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Enter coordinates instead" }).click();
  await page.locator("#loc-lat").fill("24.7136");
  await page.locator("#loc-lng").fill("46.6753");
  await page.locator("#loc-tz").fill("Asia/Riyadh");
  await page.locator("#loc-apply").click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  if (opts.witr) await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha", ...(opts.witr ? ["witr"] : [])];
  for (const p of prayers) await page.locator(`#debt-${p}`).fill("99999");
  void prayers;
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("radio", { name: /Fajr first/ }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: /^Finish( without reminders)?$/ }).click();
  await expect(page.getByText("Prayers owed")).toBeVisible();
  return page;
}

test("no route scrolls horizontally at 320px, even with six-digit debts and Witr", async ({ browser }) => {
  const page = await seeded(browser, { width: 320, height: 568 }, { witr: true });
  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${route} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/320${route === "/" ? "-today" : route.replace(/[/~]/g, "-")}.png` });
  }
  await page.context().close();
});

test("every control is at least 44px in both directions", async ({ browser }) => {
  const page = await seeded(browser, { width: 390, height: 844 });
  for (const route of ["/", "/log", "/plan", "/stats", "/settings"]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("button, [role=switch], [role=radio], select, input, nav a, a.brut, a.brut-sm")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ el, r }) => (r.height < 43.5 || r.width < 43.5) && !(el instanceof HTMLInputElement && el.type === "checkbox"))
        .map(({ el, r }) => `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`),
    );
    expect(small, `${route}: controls under 44px`).toEqual([]);
  }
  await page.context().close();
});

test("pending prayers are reviewed on one screen, one tap each", async ({ browser }) => {
  const page = await seeded(browser, { width: 390, height: 844 });
  await expect(page.getByText("2 pending", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/20-today-pending.png` });

  await page.getByRole("button", { name: "Review 2 pending prayers" }).first().click();
  const sheet = page.getByRole("dialog", { name: /^Review/ });
  await expect(sheet).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/21-review-sheet.png` });

  await sheet.getByRole("group", { name: "Fajr" }).getByRole("button", { name: "On time" }).click();
  await sheet.getByRole("group", { name: "Dhuhr" }).getByRole("button", { name: "Missed" }).click();
  await sheet.getByRole("button", { name: "Done" }).click();

  await expect(page.getByRole("button", { name: "Fajr, prayed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dhuhr, missed" })).toBeVisible();
  await expect(page.getByText("2 pending", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/22-today-reviewed.png` });
  await page.context().close();
});

test("a sheet takes focus, traps it, closes on Escape and gives focus back", async ({ browser }) => {
  const page = await seeded(browser, { width: 390, height: 844 });
  const trigger = page.getByRole("button", { name: "Log qada" }).last();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Log qada" });
  await expect(sheet).toBeVisible();

  // Focus is inside the dialog and stays there however far you tab.
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
  }
  // The page behind is inert.
  expect(await page.evaluate(() => document.querySelector("main")?.closest("[inert]") !== null)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.context().close();
});

test("the strategy editor fits a short phone and its save button is always reachable", async ({ browser }) => {
  const page = await seeded(browser, { width: 320, height: 568 });
  await page.goto("/plan");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Edit plan" });
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(568);
  await expect(sheet.getByRole("button", { name: "Save", exact: true })).toBeInViewport();
  await expect(sheet.locator("#strategy-name")).toBeInViewport();
  await page.screenshot({ path: `${SHOTS}/23-editor-320.png` });
  await page.context().close();
});

test("desktop shows a side rail instead of a floating tab bar", async ({ browser }) => {
  const page = await seeded(browser, { width: 1280, height: 800 });
  await expect(page.getByRole("complementary").getByRole("link", { name: "Plan" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/30-desktop-today.png` });
  await page.goto("/stats");
  await page.screenshot({ path: `${SHOTS}/31-desktop-stats.png` });
  await page.context().close();
});

test("a prayer whose window has not opened cannot be answered", async ({ browser }) => {
  const page = await seeded(browser, { width: 390, height: 844 });
  // 16:30: Asr is open, Maghrib and Isha are still ahead.
  const isha = page.getByLabel(/^Isha, starts at .* not open yet$/);
  await expect(isha).toBeVisible();
  expect(await isha.evaluate((el) => el.tagName)).toBe("DIV");
  // The open prayer shows how long is left, and can be answered.
  await expect(page.getByRole("button", { name: /^Asr, open now, .* left$/ })).toBeVisible();
  await page.context().close();
});

test("without prayer times the resolve sheet does not ask on time versus late", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Set this later" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // The estimate refuses a reversed range instead of reporting zero.
  await page.getByRole("button", { name: "Estimate from dates" }).click();
  await page.locator("#w-start").fill("2020-01-01");
  await page.locator("#w-end").fill("2010-01-01");
  await expect(page.getByText("The second date has to come after the first.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use this estimate" })).toBeDisabled();
  await page.locator("#w-end").fill("2022-01-01");
  await page.getByRole("button", { name: "Use this estimate" }).click();
  await expect(page.locator("#debt-fajr")).toHaveValue("731");
  await expect(page.getByText(/is a number, not a verdict/)).toBeVisible();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: /^Finish( without reminders)?$/ }).click();
  await expect(page.getByText("Prayers owed")).toBeVisible();

  await page.getByRole("button", { name: /^Fajr, not answered yet$/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "Prayed", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Prayed late" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Setup cannot silently overwrite an existing ledger.
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Set up again?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep my ledger as it is" }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  await ctx.close();
});
