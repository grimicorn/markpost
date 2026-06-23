import { test, expect } from "@playwright/test";
import {
  clerk,
  clerkSetup,
  setupClerkTestingToken,
} from "@clerk/testing/playwright";
import { TEST_USER_EMAIL } from "./helpers/clerk";

test.describe("login page", () => {
  // Fetches the Clerk testing token once so Clerk's Frontend API bypasses bot
  // detection during these tests.
  test.beforeAll(async () => {
    await clerkSetup();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/login");
    // Wait for Clerk's SignIn component to finish loading its UI
    await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });
  });

  test("page renders the two-column layout", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Sign in to markpost", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("welcome back", { exact: true })).toBeVisible();
    await expect(page.locator(".term")).toBeVisible();
    await expect(page.getByText(/turned my chaotic inbox/)).toBeVisible();
  });

  test("shows a validation error for empty and invalid email input", async ({
    page,
  }) => {
    // Empty submit — Clerk should keep us on /login with the identifier field visible
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.locator('input[name="identifier"]')).toBeVisible();
    await expect(page).toHaveURL("/login");

    // Invalid email — Clerk should reject and stay on the same page
    await page.fill('input[name="identifier"]', "notanemail");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.locator('input[name="identifier"]')).toBeVisible({
      timeout: 4000,
    });
    await expect(page).toHaveURL("/login");
  });

  test("signs in as the Clerk test user", async ({ page }) => {
    // Uses Clerk's test-email flow (email_code with the fixed 424242 code) via
    // the @clerk/testing helper — no real inbox or separate account required.
    await clerk.signIn({
      page,
      signInParams: { strategy: "email_code", identifier: TEST_USER_EMAIL },
    });

    const signedInEmail = await page.evaluate(
      () => window.Clerk?.user?.primaryEmailAddress?.emailAddress ?? null,
    );
    expect(signedInEmail).toBe(TEST_USER_EMAIL);
  });

  test("logo navigates back to the landing page", async ({ page }) => {
    await page.locator("a[href='/']").first().click();
    await expect(page).toHaveURL("/");
  });
});
