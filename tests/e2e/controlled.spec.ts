import { expect, test, type Browser, type Page } from "@playwright/test";

const origin = "https://localhost:3102";

async function controlledPage(browser: Browser, javaScriptEnabled = true) {
  const context = await browser.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
    javaScriptEnabled,
  });
  return { context, page: await context.newPage() };
}

async function signIn(page: Page, username: string) {
  await page.getByRole("button", { name: "Continue to sign in" }).click();
  await expect(page).toHaveURL(/keycloak\.localtest\.me:8443/);
  await page.locator("#username").fill(username);
  await page.locator("#password").fill("password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(origin + "/");
}

test("controlled access uses HTTPS and the mapped group", async ({ browser }) => {
  const { context, page } = await controlledPage(browser);
  try {
    const anonymous = await context.request.get("/", { maxRedirects: 0 });
    expect(anonymous.status()).toBe(302);
    expect(anonymous.headers().location).toBe("/auth/login?returnTo=%2F");
    expect(await anonymous.text()).not.toContain("Application Programming Interface");
    const foreignOrigin = await context.request.post("/auth/login", {
      headers: { Origin: "https://other.example.test" },
      maxRedirects: 0,
    });
    expect(foreignOrigin.status()).toBe(403);

    await page.goto("/");
    await expect(page.getByText("Authorized test access only.")).toBeVisible();
    await signIn(page, "admin-user");
    await expect(page.getByText("Application Programming Interface")).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Content handling notice" }),
    ).toHaveText("Test controlled content");
    const sessionCookies = await context.cookies(origin);
    expect(sessionCookies.some((cookie) => cookie.secure)).toBe(true);
  } finally {
    await context.close();
  }

  const denied = await controlledPage(browser);
  try {
    await denied.page.goto("/");
    const deniedResponse = denied.page.waitForResponse((response) =>
      response.url() === origin + "/" && response.status() === 403,
    );
    await signIn(denied.page, "user");
    const response = await deniedResponse;
    expect(await response.text()).not.toContain("Application Programming Interface");
  } finally {
    await denied.context.close();
  }
});

test("controlled search sends content in POST bodies without URL metadata", async ({ browser }) => {
  const { context, page } = await controlledPage(browser);
  try {
    await page.goto("/");
    await signIn(page, "admin-user");

    const searchResponse = page.waitForResponse((response) => {
      const request = response.request();
      return (
        request.method() === "POST" &&
        new URL(request.url()).pathname.endsWith(".data") &&
        new URLSearchParams(request.postData() ?? "").get("q") === "performance"
      );
    });
    await page.getByLabel("Sort results").selectOption("recent");
    await page.getByRole("searchbox", { name: "Search acronyms" }).fill("performance");
    const response = await searchResponse;
    expect(response.status()).toBe(200);
    expect(new URLSearchParams(response.request().postData() ?? "").get("sort")).toBe("recent");
    expect(response.url()).not.toContain("performance");
    expect(JSON.stringify(response.headers())).not.toContain("performance");
    await expect(page.getByText('2 results for "performance"')).toBeVisible();
    await expect(page.getByText("Annual Performance Index")).toBeVisible();
    expect(page.url()).toBe(origin + "/");

    const native = await controlledPage(browser, false);
    try {
      await native.context.addCookies(await context.cookies(origin));
      await native.page.goto("/");
      await native.page.getByLabel("Sort results").selectOption("recent");
      await native.page.getByRole("searchbox", { name: "Search acronyms" }).fill("performance");
      const nativeRequest = native.page.waitForRequest((request) =>
        request.method() === "POST" && request.url() === origin + "/",
      );
      await native.page.getByRole("button", { name: "Search" }).click();
      const request = await nativeRequest;
      expect(new URLSearchParams(request.postData() ?? "").get("q")).toBe("performance");
      expect(new URLSearchParams(request.postData() ?? "").get("sort")).toBe("recent");
      expect(native.page.url()).toBe(origin + "/");
    } finally {
      await native.context.close();
    }
  } finally {
    await context.close();
  }
});
