import { test, expect, type Page } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_CLERK_TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.E2E_CLERK_TEST_PASSWORD ?? "";

async function fillSignInForm(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.fill('input[name="identifier"]', email);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForSelector('input[name="password"]', { timeout: 8000 });
  await page.fill('input[name="password"]', password);
  await page.getByRole("button", { name: /continue/i }).click();
}

test.describe("login page", () => {
  test.beforeEach(async ({ page }) => {
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

  test("shows an error for wrong credentials", async ({ page }) => {
    test.skip(!TEST_EMAIL, "E2E_CLERK_TEST_EMAIL not set");

    await fillSignInForm(page, TEST_EMAIL, "definitely-wrong-password");

    await expect(
      page
        .getByText(/password is incorrect/i)
        .or(page.getByText(/invalid credentials/i))
        .or(page.getByText(/password.*incorrect/i)),
    ).toBeVisible({ timeout: 8000 });
  });

  test("signs in with valid credentials and redirects away from /login", async ({
    page,
  }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, "Clerk test credentials not set");

    await fillSignInForm(page, TEST_EMAIL, TEST_PASSWORD);

    // After successful auth Clerk redirects; we should leave /login
    await expect(page).not.toHaveURL("/login", { timeout: 12000 });
  });

  test("logo navigates back to the landing page", async ({ page }) => {
    await page.locator("a[href='/']").first().click();
    await expect(page).toHaveURL("/");
  });
});
