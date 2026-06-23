import { test, expect, type Page } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from "./helpers/clerk";

// Clerk's test code for test emails (+clerk_test) — satisfies email/device
// verification without a real inbox.
const TEST_VERIFICATION_CODE = "424242";

async function submitIdentifier(page: Page, email: string): Promise<void> {
  await page.fill('input[name="identifier"]', email);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/\/login\/factor-one/, { timeout: 10000 });
}

async function submitPassword(page: Page, password: string): Promise<void> {
  const passwordField = page.locator('input[name="password"]');
  await passwordField.waitFor({ state: "visible", timeout: 8000 });
  await passwordField.fill(password);
  await page.getByRole("button", { name: /continue/i }).click();
}

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

  test("advances past the email step without hitting the 404 page", async ({
    page,
  }) => {
    // Regression: the SignIn flow navigates to /login/factor-one, which must be
    // served by the catch-all login route rather than the global 404 page.
    await submitIdentifier(page, TEST_USER_EMAIL);

    await expect(page.getByText("This page never synced.")).toHaveCount(0);
    await expect(page.locator(".cl-card")).toBeVisible({ timeout: 8000 });
  });

  test("shows an error for an incorrect password", async ({ page }) => {
    await submitIdentifier(page, TEST_USER_EMAIL);
    await submitPassword(page, "definitely-wrong-password");

    await expect(page.getByText(/password is incorrect/i).first()).toBeVisible({
      timeout: 8000,
    });
    await expect(page).toHaveURL(/\/login\/factor-one/);
  });

  test("signs in through the full UI flow", async ({ page }) => {
    await submitIdentifier(page, TEST_USER_EMAIL);
    await submitPassword(page, TEST_USER_PASSWORD);

    // New-device verification (client trust). Clerk renders a numeric code
    // field; the test code completes it without a real email.
    await page.waitForURL(/\/login\/client-trust/, { timeout: 10000 });
    await page
      .locator('input[inputmode="numeric"]')
      .first()
      .fill(TEST_VERIFICATION_CODE);

    // A completed sign-in redirects away from the /login flow.
    await expect(page).not.toHaveURL(/\/login/, { timeout: 12000 });
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
