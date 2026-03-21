import { defineConfig } from "@playwright/test";

/**
 * UAT/E2E config — runs against production build for stability.
 *
 * Environment:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *   - globalSetup runs npm run seed so UAT personas and data exist (skip with SKIP_E2E_SEED=1)
 *
 * Run: npm run test:e2e   (builds, seeds via globalSetup, starts server, runs tests)
 * Or:  npm run seed:e2e   (explicit seed then test:e2e)
 */
export default defineConfig({
  globalSetup: "./scripts/playwright-global-setup.ts",
  testDir: "./tests",
  snapshotDir: "./tests/__screenshots__",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: process.env.CI ? "github" : "html",
  timeout: 45_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    trace: "on-first-retry",
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    gotoOptions: { waitUntil: "domcontentloaded" },
  },
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "npm run start" : "npm run build && npm run start",
        url: "http://localhost:3000/api/ready",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: { ...process.env, APP_URL: "http://localhost:3000" },
      },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
