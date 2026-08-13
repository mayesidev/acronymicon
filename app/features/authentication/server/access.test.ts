import { describe, expect, it } from "vitest";

import { parseAppConfig } from "../../../platform/config/runtime.server";
import { commitSession, getSession } from "./session";
import {
  authorizeDictionaryAccess,
  authorizeSubmissionAccess,
  hasCapability,
  shouldShowSubmissionAction,
} from "./access";

describe("dictionary access", () => {
  it("allows anonymous access in the default open mode", async () => {
    await expect(
      authorizeDictionaryAccess(
        new Request("http://localhost/?q=api"),
        parseAppConfig({}),
      ),
    ).resolves.toBeNull();
  });

  it("redirects anonymous document requests to sign in", async () => {
    const response = await authorizeDictionaryAccess(
      new Request("http://localhost/define?acr=API&sort=recent"),
      authenticatedConfig(),
    );

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("Expected dictionary access to redirect.");
    }
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "/auth/login?returnTo=%2Fdefine%3Facr%3DAPI%26sort%3Drecent",
    );
  });

  it("does not use an internal data endpoint as a return destination", async () => {
    const response = await authorizeDictionaryAccess(
      new Request("http://localhost/define.data?acr=API"),
      authenticatedConfig(),
    );

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("Expected dictionary access to redirect.");
    }
    expect(response.headers.get("Location")).toBe("/auth/login?returnTo=%2F");
  });

  it("returns the authenticated user in authenticated mode", async () => {
    const request = await authenticatedRequest("http://localhost/", []);

    await expect(
      authorizeDictionaryAccess(request, authenticatedConfig()),
    ).resolves.toMatchObject({ id: "user-123", username: "local-user" });
  });

  it("denies an authenticated user without a configured controlled-profile group", async () => {
    const response = await rejectedResponse(
      authorizeDictionaryAccess(
        await authenticatedRequest("https://app.example.test/", ["other"]),
        controlledConfig(),
      ),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("");
  });

  it.each([["dictionary-readers"], ["dictionary-submitters"]])(
    "allows controlled-profile dictionary access for %s",
    async (group) => {
      await expect(
        authorizeDictionaryAccess(
          await authenticatedRequest("https://app.example.test/", [group]),
          controlledConfig(),
        ),
      ).resolves.toMatchObject({ id: "user-123" });
    },
  );

  it("matches controlled-profile groups exactly and case-sensitively", () => {
    expect(
      hasCapability(
        userWithGroups(["Dictionary-Readers"]),
        "dictionary:read",
        controlledConfig(),
      ),
    ).toBe(false);
  });

  it("shows submission by default but hides it from controlled-profile readers", () => {
    expect(shouldShowSubmissionAction(null, parseAppConfig({}))).toBe(true);
    expect(
      shouldShowSubmissionAction(
        userWithGroups(["dictionary-readers"]),
        controlledConfig(),
      ),
    ).toBe(false);
  });
});

describe("submission access", () => {
  it("redirects an anonymous request to sign in", async () => {
    const response = await authorizeSubmissionAccess(
      new Request("http://localhost/submit"),
      parseAppConfig({}),
    );

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("Expected submission access to redirect.");
    }
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "/auth/login?returnTo=%2Fsubmit",
    );
  });

  it("preserves submission access for any authenticated standard-profile user", async () => {
    await expect(
      authorizeSubmissionAccess(
        await authenticatedRequest("http://localhost/submit", []),
        parseAppConfig({}),
      ),
    ).resolves.toMatchObject({ id: "user-123" });
  });

  it("denies a controlled-profile read-only user", async () => {
    const response = await rejectedResponse(
      authorizeSubmissionAccess(
        await authenticatedRequest("https://app.example.test/submit", [
          "dictionary-readers",
        ]),
        controlledConfig(),
      ),
    );

    expect(response.status).toBe(403);
  });

  it("allows a controlled-profile submitter", async () => {
    await expect(
      authorizeSubmissionAccess(
        await authenticatedRequest("https://app.example.test/submit", [
          "dictionary-submitters",
        ]),
        controlledConfig(),
      ),
    ).resolves.toMatchObject({ id: "user-123" });
  });
});

function authenticatedConfig() {
  return parseAppConfig({
    ACRONYMICON_DICTIONARY_ACCESS: "authenticated",
    OIDC_ISSUER_URL: "http://issuer.example.test/realms/acronymicon",
    OIDC_CLIENT_ID: "acronymicon",
    OIDC_CLIENT_SECRET: "client-secret",
  });
}

function controlledConfig() {
  return parseAppConfig({
    ACRONYMICON_DEPLOYMENT_PROFILE: "controlled",
    ACRONYMICON_PUBLIC_ORIGIN: "https://app.example.test",
    ACRONYMICON_READ_GROUPS: "dictionary-readers",
    ACRONYMICON_SUBMIT_GROUPS: "dictionary-submitters",
    NODE_ENV: "production",
    SESSION_SECRET: "production-secret",
    OIDC_ISSUER_URL: "https://issuer.example.test/realms/acronymicon",
    OIDC_CLIENT_ID: "acronymicon",
    OIDC_CLIENT_SECRET: "client-secret",
    OIDC_REDIRECT_URI: "https://app.example.test/auth/callback",
    OIDC_POST_LOGOUT_REDIRECT_URI: "https://app.example.test/",
  });
}

async function authenticatedRequest(url: string, groups: string[]) {
  const session = await getSession();
  session.set("user", userWithGroups(groups));

  return new Request(url, {
    headers: { Cookie: await commitSession(session) },
  });
}

function userWithGroups(groups: string[]) {
  return {
    id: "user-123",
    username: "local-user",
    groups,
  };
}

async function rejectedResponse(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }

  throw new Error("Expected access to be denied.");
}
