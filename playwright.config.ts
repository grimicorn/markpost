import { defineConfig, devices } from "@playwright/test";

// Env is injected by dotenvx before Playwright starts (see the "e2e" npm
// scripts: `dotenvx run -f .env.e2e -- playwright test`). In CI the workflow
// overrides E2E_DATABASE_URL with a fresh per-run Neon branch.

// @clerk/testing requires standard CLERK_* names; map from Nuxt conventions.
if (!process.env.CLERK_SECRET_KEY && process.env.NUXT_CLERK_SECRET_KEY) {
  process.env.CLERK_SECRET_KEY = process.env.NUXT_CLERK_SECRET_KEY;
}
if (
  !process.env.CLERK_PUBLISHABLE_KEY &&
  process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY
) {
  process.env.CLERK_PUBLISHABLE_KEY =
    process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}

const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/artifacts",
  reporter: [["html", { outputFolder: "e2e/report" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3002",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // dev:test is a raw `nuxt dev` (no dotenvx) — env comes from the dotenvx run
    // that started Playwright, merged with the pins below. CI only holds the e2e
    // key, so the server must not try to decrypt .env itself.
    command: "npm run dev:test -- --port 3002",
    url: "http://localhost:3002",
    reuseExistingServer: !process.env.CI,
    env: {
      // Pin the DB to the e2e branch. Nuxt's built-in .env loader would otherwise
      // inject the encrypted (ciphertext) NUXT_DATABASE_URL from the committed
      // .env and override runtimeConfig.databaseUrl.
      NUXT_DATABASE_URL: E2E_DATABASE_URL,
      DATABASE_URL: E2E_DATABASE_URL,
      // Block the encrypted Sentry DSN from being injected; empty cleanly
      // disables Sentry for e2e runs.
      NUXT_PUBLIC_SENTRY_DSN: "",
      SENTRY_DSN: "",
      NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
      NUXT_CLERK_SECRET_KEY: process.env.NUXT_CLERK_SECRET_KEY ?? "",
      // Pin so the encrypted NUXT_PUBLIC_APP_URL can't bake ciphertext into the
      // public runtime config during e2e.
      NUXT_PUBLIC_APP_URL: "http://localhost:3002",
    },
  },
});
