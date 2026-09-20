import { devices, expect, test, type Page } from "@playwright/test";

/**
 * One browser context for the whole file: the ledger lives in IndexedDB, so the
 * tests build on each other the way a real session does.
 */
const SHOTS = "e2e/screenshots";
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  const { defaultBrowserType: _ignored, ...device } = devices["iPhone 13"];
  void _ignored;
  const context = await browser.newContext(device);
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
});

async function shot(name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test("onboarding writes the ledger and lands on Today", async () => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByText("Step 1 of 5: Where you pray")).toBeVisible();
  await shot("01-onboarding-where");

  await page.getByRole("button", { name: "Skip for now" }).click();
  await shot("02-onboarding-how");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  for (const p of ["fajr", "dhuhr", "asr", "maghrib", "isha"]) await page.locator(`#debt-${p}`).fill("4000");
  await expect(page.getByText("20,000 prayers")).toBeVisible();
  await shot("03-onboarding-owed");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Every template previews its finish date before you commit.
  const fajrFirst = page.getByRole("radio", { name: /Fajr first/ });
  await expect(fajrFirst).toContainText(/20\d\d/);
  await fajrFirst.click();
  await shot("04-onboarding-plan");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect(page.getByText("Your setup")).toBeVisible();
  await shot("05-onboarding-finish");
  await page.getByRole("button", { name: /^Finish( without reminders)?$/ }).click();

  await expect(page).toHaveURL("http://localhost:3100/");
  await expect(page.getByText("Prayers owed")).toBeVisible();
  await expect(page.getByText("20,000", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fajr first" })).toBeVisible();
  await shot("06-today");
});

test("the onboarding draft survives a reload", async ({ browser }) => {
  const { defaultBrowserType: _ignored, ...device } = devices["iPhone 13"];
  void _ignored;
  const ctx = await browser.newContext(device);
  const p = await ctx.newPage();
  await p.goto("/onboarding");
  await p.getByRole("button", { name: "Skip for now" }).click();
  await p.getByRole("button", { name: "Next", exact: true }).click();
  await p.locator("#debt-fajr").fill("1234");
  await p.reload();
  await expect(p.getByText("Step 3 of 5: What you owe")).toBeVisible();
  await expect(p.locator("#debt-fajr")).toHaveValue("1234");
  await ctx.close();
});

test("logging qada updates the debt and can be undone", async () => {
  await page.getByRole("button", { name: "Log qada" }).first().click();
  await expect(page.getByRole("dialog", { name: "Log qada" })).toBeVisible();
  await page.getByRole("button", { name: "Five more" }).click();
  await shot("07-log-sheet");
  await page.getByRole("button", { name: /^Log 6 Fajr$/ }).click();
  await expect(page.getByText("19,994", { exact: true })).toBeVisible();
  await shot("08-today-after-log");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("20,000", { exact: true })).toBeVisible();
});

test("a daily prayer can be marked missed and the debt grows by one, without any alarm colour", async () => {
  await page.getByRole("button", { name: /^Dhuhr,/ }).click();
  await shot("09-resolve-sheet");
  await page.getByRole("button", { name: "Missed", exact: true }).click();
  await expect(page.getByText("20,001", { exact: true })).toBeVisible();
  // The net chip is neutral grey when debt rises, never coral.
  const chip = page.getByLabel(/Net change since you started: up 1/);
  await expect(chip).toBeVisible();
  await expect(chip).not.toHaveClass(/bg-coral/);
  await shot("10-today-missed");
});

test("log, plan, stats and settings render", async () => {
  await page.goto("/log");
  await expect(page.getByRole("heading", { name: "Log", exact: true })).toBeVisible();
  await expect(page.getByText("Start: 4,000 Fajr")).toBeVisible();
  await shot("11-log");

  await page.goto("/plan");
  await expect(page.getByRole("heading", { name: "Plan", exact: true })).toBeVisible();
  await expect(page.getByText("On plan")).toBeVisible();
  await shot("12-plan");

  await page.goto("/stats");
  await expect(page.getByRole("heading", { name: "Stats", exact: true })).toBeVisible();
  await shot("13-stats");

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await shot("14-settings");
});

test("undoing a structural entry asks first, and anything undone can be restored", async () => {
  await page.goto("/log");
  await page.getByRole("button", { name: "Undo: Start: 4,000 Fajr" }).click();
  await expect(page.getByRole("dialog", { name: "Undo this entry?" })).toBeVisible();
  await page.getByRole("button", { name: "Undo it" }).click();

  await page.goto("/");
  await expect(page.getByText("16,001", { exact: true })).toBeVisible();

  await page.goto("/log");
  await page.getByRole("button", { name: /^Show \d+ undone/ }).click();
  await page.getByRole("button", { name: "Restore: Start: 4,000 Fajr" }).click();
  await page.goto("/");
  await expect(page.getByText("20,001", { exact: true })).toBeVisible();
});

test("switching strategy closes the period and keeps the math", async () => {
  await page.goto("/plan");
  await page.getByRole("button", { name: "Switch plan" }).click();
  await page.getByRole("button", { name: /One with each/ }).click();
  await expect(page.getByRole("dialog", { name: "New plan" })).toBeVisible();
  await shot("15-plan-editor");
  await page.getByRole("button", { name: "Start plan" }).click();
  await expect(page.getByText('Plan "One with each" started.')).toBeVisible();
  // A running period on its first day says so rather than showing 0%.
  await expect(page.getByText("first day")).toBeVisible();
  await shot("16-plan-switched");

  await page.goto("/");
  await expect(page.getByText("20,001", { exact: true })).toBeVisible();
});
