import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke tests run against `next dev` with auth made optional, so they need
 * no Google credentials and no database. Sync will fail (no DATABASE_URL) and the app
 * must keep working locally, which is exactly the behaviour under test.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx next dev --port 3100",
    url: "http://localhost:3100/sign-in",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_AUTH_OPTIONAL: "true",
      NEXT_TELEMETRY_DISABLED: "1",
      BETTER_AUTH_SECRET: "e2e-only-secret-not-for-production-0000000000",
      BETTER_AUTH_URL: "http://localhost:3100",
    },
  },
});
