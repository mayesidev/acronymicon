import { expect, test, type Page } from "@playwright/test";

test("anonymous users can browse and search seeded entries", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("hydrated but some attributes")
    ) {
      hydrationErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Acronymicon" }),
  ).toBeVisible();
  await expect(
    page.getByText("Application Programming Interface"),
  ).toBeVisible();

  const submitLink = page.getByRole("link", { name: "Submit acronym" });
  const aboutLink = page.getByRole("link", { name: "About Acronymicon" });
  await page.keyboard.press("Tab");
  await expect(aboutLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(submitLink).toBeFocused();
  await expect(submitLink).not.toHaveCSS("box-shadow", "none");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeFocused();

  await page.locator('input[name="q"]').fill("performance");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/q=performance/);
  await expect(page.getByText("Annual Performance Index")).toBeVisible();
  await expect(
    page.getByText("Application Programming Interface"),
  ).toBeHidden();
  await expect(aboutLink).toHaveAttribute(
    "href",
    "/about?returnTo=%2F%3Fq%3Dperformance%26sort%3Dalphabetical",
  );

  await aboutLink.click();
  await expect(
    page.getByRole("heading", { name: "About Acronymicon" }),
  ).toBeVisible();
  await expect(page.getByText("v0.0.0-e2e")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Read the MIT License" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/mayesidev/acronymicon/blob/main/LICENSE",
  );
  await expect(
    page.getByRole("link", { name: "View Acronymicon source on GitHub" }),
  ).toHaveAttribute("href", "https://github.com/mayesidev/acronymicon");

  await page.getByRole("link", { name: "Back to dictionary" }).click();
  await expect(page).toHaveURL((url) => {
    return url.pathname === "/" && url.searchParams.get("q") === "performance";
  });
  await expect(
    page.getByRole("heading", { name: "Acronymicon" }),
  ).toBeVisible();
  await expect(page.getByText("Annual Performance Index")).toBeVisible();
  await expect(
    page.getByText("Application Programming Interface"),
  ).toBeHidden();
  expect(hydrationErrors).toEqual([]);
});

test("authenticated dictionary access protects pages and data requests", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://localhost:3101",
  });
  const request = context.request;
  const page = await context.newPage();

  for (const dataUrl of ["/_.data?q=API", "/define.data?acr=API"]) {
    const dataResponse = await request.get(dataUrl, {
      maxRedirects: 0,
    });
    expect(dataResponse.status()).toBe(302);
    expect(dataResponse.headers().location).toBe(
      "/auth/login?returnTo=%2F",
    );
  }

  await page.goto("/define?acr=API&sort=recent");
  await signIn(page, "user");
  await expect(page).toHaveURL(
    "http://localhost:3101/define?acr=API&sort=recent",
  );
  await expect(
    page.getByText("Application Programming Interface"),
  ).toBeVisible();

  await context.close();
});

test("users can open a specific definition variant and see marked ranges", async ({
  page,
}) => {
  await page.goto("/define?acr=api");
  await expect(page.getByLabel("Sort definitions")).toHaveValue(
    "alphabetical",
  );
  await expect(page.locator("ol > li h2")).toHaveText([
    "Annual Performance Index",
    "Application Programming Interface",
  ]);
  await page.getByLabel("Sort definitions").selectOption("recent");
  await expect(page).toHaveURL(/sort=recent/);

  await page.goto("/define?acr=radar&var=1");

  const definitionHeading = page.getByRole("heading", { name: "RADAR" });
  const backLink = page.getByRole("link", { name: "Back to dictionary" });
  await expect(definitionHeading).toBeVisible();
  await expect(backLink).toHaveAttribute("href", "/");
  const backLinkBox = await backLink.boundingBox();
  const definitionHeadingBox = await definitionHeading.boundingBox();
  expect(backLinkBox).not.toBeNull();
  expect(definitionHeadingBox).not.toBeNull();
  expect(backLinkBox!.y).toBeLessThan(definitionHeadingBox!.y);
  await expect(page.getByText("Radio Detection And Ranging")).toBeVisible();
  await expect(page.locator("u")).toHaveCount(4);

  await page.goto("/define?acr=radar&var=2");
  await expect(
    page.getByRole("heading", { name: "Definition not found" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View all definitions for radar" }),
  ).toHaveAttribute("href", "/define?acr=radar");
  await expect(backLink).toBeVisible();

  await page.goto("/define");
  await expect(
    page.getByRole("heading", { name: "Choose an acronym" }),
  ).toBeVisible();
  await expect(backLink).toBeVisible();
});

test("users can submit and review duplicate definitions", async ({ page }) => {
  const anonymousResponse = await page.request.get("/submit", {
    maxRedirects: 0,
  });
  expect(anonymousResponse.status()).toBe(302);
  expect(anonymousResponse.headers().location).toBe(
    "/auth/login?returnTo=%2Fsubmit",
  );
  const anonymousActionResponse = await page.request.post("/submit", {
    form: { acronym: "API", definition: "Application Programming Interface" },
    maxRedirects: 0,
  });
  expect(anonymousActionResponse.status()).toBe(302);
  expect(anonymousActionResponse.headers().location).toBe(
    "/auth/login?returnTo=/submit",
  );

  await page.goto("/submit");
  await signIn(page, "user");

  await expect(page.getByText("Signed in as Local User")).toBeVisible();
  const acronym = page.getByRole("textbox", { name: "Acronym" });
  const definition = page.getByRole("textbox", { name: "Definition" });
  const notes = page.getByRole("textbox", { name: "Notes" });
  await expect(acronym).toHaveAttribute("required", "");
  await expect(definition).toHaveAttribute("required", "");
  await expect(notes).not.toHaveAttribute("required");
  const initialDefinitionPosition = await definition.boundingBox();
  const initialNotesPosition = await notes.boundingBox();
  const initialAcronymPosition = await acronym.boundingBox();
  expect(initialAcronymPosition).not.toBeNull();
  expect(initialDefinitionPosition).not.toBeNull();
  expect(initialNotesPosition).not.toBeNull();
  expect(initialDefinitionPosition!.x).toBe(initialAcronymPosition!.x);
  expect(initialNotesPosition!.x).toBe(initialAcronymPosition!.x);
  expect(initialAcronymPosition!.y).toBeLessThan(initialDefinitionPosition!.y);
  expect(initialDefinitionPosition!.y).toBeLessThan(initialNotesPosition!.y);
  await acronym.fill("API");
  const warningButton = page.getByRole("button", { name: "See warning" });
  await expect(warningButton).toBeVisible();
  const warningAcronymPosition = await acronym.boundingBox();
  expect(warningAcronymPosition?.y).toBe(initialAcronymPosition?.y);
  await definition.fill("A");
  await expect(warningButton).toBeVisible();
  await definition.fill("An");
  await expect(warningButton).toBeVisible();
  await warningButton.click();
  await expect(page.getByRole("dialog")).toContainText(
    "Application Programming Interface",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(warningButton).toBeFocused();

  await acronym.fill("E2E");
  await definition.fill("[End] To End Verification");
  await expect(definition).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(/Marked definition ranges/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();

  await definition.fill("End To End Verification");
  await expect(definition).not.toHaveAttribute("aria-invalid");
  const keyboardResponse = waitForSubmitResponse(page);
  await definition.press("Enter");
  await keyboardResponse;
  await expect(page).toHaveURL(/q=E2E/);
  await expect(page.getByText("End To End Verification")).toBeVisible();

  await page.goto("/submit");
  expect(
    (await submit(page, "E2E", "Browser Integration Verification")).status(),
  ).toBe(409);
  await page.getByRole("button", { name: "See warning" }).click();
  await expect(page.getByRole("dialog")).toContainText("E2E already exists");
  await expect(page.getByRole("dialog")).toContainText(
    "End To End Verification",
  );
  await page.getByRole("button", { name: "Close" }).click();
  const confirmedResponse = waitForSubmitResponse(page);
  await page.getByRole("button", { name: "Submit Anyway" }).click();
  await confirmedResponse;
  await expect(page).toHaveURL(/q=E2E/);
  await expect(
    page.getByText("Browser Integration Verification"),
  ).toBeVisible();

  await page.goto("/submit");
  expect((await submit(page, "E2E", "End To End Verification")).status()).toBe(
    400,
  );
  await page.getByRole("button", { name: "See warning" }).click();
  const exactDuplicateWarning = page.getByRole("dialog");
  await expect(exactDuplicateWarning).toContainText(
    "This definition already exists",
  );
  await expect(exactDuplicateWarning).toContainText("End To End Verification");
  await expect(exactDuplicateWarning).not.toContainText(
    "Browser Integration Verification",
  );
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();
});

test("users can sign out and switch accounts", async ({ page }) => {
  await page.goto("/submit");
  await signIn(page, "user");

  await page.goto("/");
  const account = page.getByRole("group", { name: "Account" });
  await expect(account).toContainText("Signed in as");
  await expect(account).toContainText("Local User");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "About Acronymicon" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Submit acronym" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  const signOut = account.getByRole("button", { name: "Sign out" });
  await expect(signOut).toBeFocused();
  await expect(signOut).not.toHaveCSS("box-shadow", "none");
  const submitBox = await page
    .getByRole("link", { name: "Submit acronym" })
    .boundingBox();
  const signOutBox = await signOut.boundingBox();
  expect(signOutBox?.y).toBe(submitBox?.y);
  expect(signOutBox?.height).toBe(submitBox?.height);
  await signOut.click();
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
  await expect(page).toHaveURL(/localhost:310[01]/);
}

async function submit(page: Page, acronym: string, definition: string) {
  await page.getByLabel("Acronym").fill(acronym);
  await page.getByLabel("Definition").fill(definition);
  const response = waitForSubmitResponse(page);
  await page.getByRole("button", { name: "Submit" }).click();
  return response;
}

function waitForSubmitResponse(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/submit.data",
  );
}
