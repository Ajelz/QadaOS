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
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test("onboarding writes the ledger and lands on Today", async () => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding/);
  await shot("01-onboarding-where");

  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.locator("#debt-fajr").fill("4000");
  await page.locator("#debt-dhuhr").fill("4000");
  await page.locator("#debt-asr").fill("4000");
  await page.locator("#debt-maghrib").fill("4000");
  await page.locator("#debt-isha").fill("4000");
  await expect(page.getByText("20,000 total")).toBeVisible();
  await shot("02-onboarding-owed");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: /Fajr first/ }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Finish without reminders" }).click();

  await expect(page).toHaveURL("http://localhost:3100/");
  await expect(page.getByText("Prayers owed")).toBeVisible();
  await expect(page.getByText("20,000", { exact: true })).toBeVisible();
  await expect(page.getByText("Fajr first")).toBeVisible();
  await shot("03-today");
});

test("logging qada updates the debt and can be undone", async () => {
  await page.getByRole("button", { name: "Log qada" }).first().click();
  await page.getByRole("button", { name: "+5" }).click();
  await page.getByRole("button", { name: /^Log 6 Fajr$/ }).click();
  await expect(page.getByText("19,994", { exact: true })).toBeVisible();
  await shot("04-today-after-log");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("20,000", { exact: true })).toBeVisible();
});

test("a daily prayer can be marked missed and the debt grows by one", async () => {
  await page.getByRole("button", { name: /^Dhuhr:/ }).click();
  await page.getByRole("button", { name: "Missed" }).click();
  await expect(page.getByText("20,001", { exact: true })).toBeVisible();
  await shot("05-today-missed");
});

test("log, plan, stats and settings render", async () => {
  await page.goto("/log");
  await expect(page.getByRole("heading", { name: "Log", exact: true })).toBeVisible();
  await expect(page.getByText("Starting debt: 4,000 Fajr")).toBeVisible();
  await shot("06-log");

  await page.goto("/plan");
  await expect(page.getByRole("heading", { name: "Plan", exact: true })).toBeVisible();
  await expect(page.getByText("Plan pace")).toBeVisible();
  await shot("07-plan");

  await page.goto("/stats");
  await expect(page.getByRole("heading", { name: "Stats", exact: true })).toBeVisible();
  await shot("08-stats");

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await shot("09-settings");
});

test("switching strategy closes the period and keeps the math", async () => {
  await page.goto("/plan");
  await page.getByRole("button", { name: "Switch" }).click();
  await page.getByRole("button", { name: /One with each/ }).click();
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByText('Plan "One with each" started.')).toBeVisible();
  await expect(page.getByText("adherence").first()).toBeVisible();
  await shot("10-plan-switched");

  await page.goto("/");
  await expect(page.getByText("20,001", { exact: true })).toBeVisible();
});
