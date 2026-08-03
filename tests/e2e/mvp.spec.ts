import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("anonymous users can browse and search seeded entries", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Acronymicon" })).toBeVisible();
  await expect(page.getByText("Application Programming Interface")).toBeVisible();

  await page.locator('input[name="q"]').fill("performance");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/q=performance/);
  await expect(page.getByText("Annual Performance Index")).toBeVisible();
  await expect(page.getByText("Application Programming Interface")).toBeHidden();
});

test("users can submit, review duplicates, sign out, and switch accounts", async ({
  page,
}) => {
  await page.goto("/submit");
  await signIn(page, "user");

  await expect(page.getByText("Signed in as Local User")).toBeVisible();
  await submit(page, "E2E", "End To End Verification");
  await expect(page).toHaveURL(/q=E2E/);
  await expect(page.getByText("End To End Verification")).toBeVisible();

  await page.goto("/submit");
  await submit(page, "E2E", "Browser Integration Verification");
  await expect(page.getByText("E2E already exists")).toBeVisible();
  await expect(page.getByText("End To End Verification")).toBeVisible();
  await page.getByRole("button", { name: "Submit Anyway" }).click();
  await expect(page).toHaveURL(/q=E2E/);
  await expect(page.getByText("Browser Integration Verification")).toBeVisible();

  await page.goto("/submit");
  await submit(page, "E2E", "End To End Verification");
  await expect(
    page.getByText("This acronym and definition already exist."),
  ).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  await page.goto("/auth/login?returnTo=/submit");
  await signIn(page, "admin-user", { expectReauthentication: true });
  await expect(page.getByText("Signed in as Local Admin")).toBeVisible();
});

async function signIn(
  page: Page,
  username: string,
  options: { expectReauthentication?: boolean } = {},
) {
  if (options.expectReauthentication) {
    expect(new URL(page.url()).searchParams.get("prompt")).toBe("login");
  }
  await page.locator("#username").fill(username);
  await page.locator("#password").fill("password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/localhost:3100/);
}

async function submit(
  page: Page,
  acronym: string,
  definition: string,
) {
  await page.getByLabel("Acronym").fill(acronym);
  await page.getByLabel("Definition").fill(definition);
  await page.getByRole("button", { name: "Submit" }).click();
}
