import { describe, expect, it, vi } from "vitest";

import {
  commitSession,
  getSession,
  hasForceReauthentication,
} from "./session";
import {
  type AuthenticationDependencies,
  createAuthenticationWorkflow,
  safeReturnTo,
} from "./workflow";

describe("authentication workflow", () => {
  it("reports when sign-in is not configured", async () => {
    const dependencies = createDependencies({
      isOidcConfigured: () => false,
    });
    const workflow = createAuthenticationWorkflow(dependencies);

    await expect(
      workflow.beginSignIn(new Request("http://localhost/auth/login")),
    ).resolves.toEqual({ status: "not-configured" });
    expect(dependencies.buildAuthorizationUrl).not.toHaveBeenCalled();
  });

  it("starts provider authorization and stores callback state", async () => {
    const dependencies = createDependencies();
    const workflow = createAuthenticationWorkflow(dependencies);
    const outcome = await workflow.beginSignIn(
      new Request("http://localhost/auth/login?returnTo=%2Fsubmit"),
    );

    expect(outcome.status).toBe("redirect");
    if (outcome.status !== "redirect") {
      throw new Error("Expected a redirect outcome.");
    }

    expect(outcome.location).toBe("https://identity.example.test/authorize");
    expect(dependencies.buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "generated-state",
        codeVerifier: "generated-verifier",
        forceReauthentication: false,
      }),
    );
    const session = await getSession(outcome.cookies[0]);
    expect(session.get("oidcState")).toBe("generated-state");
    expect(session.get("oidcCodeVerifier")).toBe("generated-verifier");
    expect(session.get("returnTo")).toBe("/submit");
  });

  it("completes the callback and replaces transient state with the user", async () => {
    const dependencies = createDependencies();
    const workflow = createAuthenticationWorkflow(dependencies);
    const session = await getSession(null);
    session.set("oidcState", "expected-state");
    session.set("oidcCodeVerifier", "expected-verifier");
    session.set("returnTo", "/submit");
    const request = new Request("http://localhost/auth/callback?code=code", {
      headers: { Cookie: await commitSession(session) },
    });

    const outcome = await workflow.completeSignIn(request);

    expect(outcome.location).toBe("/submit");
    expect(dependencies.completeAuthorizationCodeGrant).toHaveBeenCalledWith({
      request,
      expectedState: "expected-state",
      codeVerifier: "expected-verifier",
    });
    const restored = await getSession(outcome.cookies[0]);
    expect(restored.get("user")).toEqual({
      id: "user-123",
      username: "local-user",
      groups: [],
    });
    expect(restored.get("oidcState")).toBeUndefined();
    expect(restored.get("returnTo")).toBeUndefined();
    expect(outcome.cookies[1]).toContain("Max-Age=0");
  });

  it("returns an expired callback to the dictionary with a flash message", async () => {
    const workflow = createAuthenticationWorkflow(createDependencies());

    const outcome = await workflow.completeSignIn(
      new Request("http://localhost/auth/callback"),
    );

    expect(outcome.location).toBe("/");
    expect(outcome.cookies).toHaveLength(1);
    const session = await getSession(outcome.cookies[0]);
    expect(session.get("authError")).toBe(
      "Sign-in session expired. Please try again.",
    );
  });

  it.each([
    ["provider", new URL("https://identity.example.test/logout")],
    ["local", null],
  ])("destroys the session for %s logout", async (_, providerLogoutUrl) => {
    const workflow = createAuthenticationWorkflow(
      createDependencies({
        buildOidcLogoutUrl: vi.fn().mockResolvedValue(providerLogoutUrl),
      }),
    );
    const outcome = await workflow.signOut(
      new Request("http://localhost/auth/logout"),
    );

    expect(outcome.location).toBe(providerLogoutUrl?.toString() ?? "/");
    expect(outcome.cookies[0]).toContain("Expires=Thu, 01 Jan 1970");
    expect(
      await hasForceReauthentication(
        new Request("http://localhost/auth/login", {
          headers: { Cookie: outcome.cookies[1] },
        }),
      ),
    ).toBe(true);
  });
});

describe("return destination policy", () => {
  it.each([
    [null, "/"],
    ["https://example.test", "/"],
    ["//example.test", "/"],
    ["/submit?draft=1", "/submit?draft=1"],
  ])("maps %s to %s", (value, expected) => {
    expect(safeReturnTo(value)).toBe(expected);
  });
});

function createDependencies(
  overrides: Partial<AuthenticationDependencies> = {},
): AuthenticationDependencies {
  return {
    isOidcConfigured: () => true,
    randomOidcState: () => "generated-state",
    randomOidcCodeVerifier: () => "generated-verifier",
    hasForceReauthentication: vi.fn().mockResolvedValue(false),
    buildAuthorizationUrl: vi
      .fn()
      .mockResolvedValue(new URL("https://identity.example.test/authorize")),
    completeAuthorizationCodeGrant: vi.fn().mockResolvedValue({
      id: "user-123",
      username: "local-user",
      groups: [],
    }),
    buildOidcLogoutUrl: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}
