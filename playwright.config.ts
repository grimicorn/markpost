import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.e2e", override: true });

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
    command: "npm run dev -- --port 3002",
    url: "http://localhost:3002",
    reuseExistingServer: !process.env.CI,
  },
});
