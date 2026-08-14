import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addMaximumAuthenticationAge,
  addReauthenticationPrompt,
  getOidcPostLogoutRedirectUri,
  getOidcRedirectUri,
  mapClaimsToUser,
  mapClaimsToAuthenticatedIdentity,
} from "./oidc";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OIDC claim mapping", () => {
  it("maps configured identity claims and group membership", () => {
    expect(
      mapClaimsToUser({
        sub: "user-123",
        preferred_username: "local-user",
        name: "Local User",
        email: "user@example.test",
        groups: ["acronymicon-admin"],
      }),
    ).toEqual({
      id: "user-123",
      username: "local-user",
      displayName: "Local User",
      email: "user@example.test",
      groups: ["acronymicon-admin"],
    });
  });

  it("rejects claims without a stable identifier", () => {
    expect(() => mapClaimsToUser({ name: "Missing Subject" })).toThrow(
      "stable user identifier",
    );
  });

  it.each([
    { groups: "dictionary-readers" },
    { groups: ["dictionary-readers", 42] },
    { groups: ["dictionary-readers", ""] },
  ])("does not accept a malformed groups claim", (claims) => {
    expect(mapClaimsToUser({ sub: "user-123", ...claims }).groups).toEqual([]);
  });

  it("requests provider reauthentication after an explicit logout", () => {
    const authorizationUrl = addReauthenticationPrompt(
      new URL("https://issuer.example.test/authorize?client_id=acronymicon"),
      true,
    );

    expect(authorizationUrl.searchParams.get("prompt")).toBe("login");
  });

  it("requests and validates a bounded provider authentication age", () => {
    const authorizationUrl = addMaximumAuthenticationAge(
      new URL("https://issuer.example.test/authorize?client_id=acronymicon"),
      1_800,
    );

    expect(authorizationUrl.searchParams.get("max_age")).toBe("1800");
    expect(
      mapClaimsToAuthenticatedIdentity(
        { sub: "user-123", auth_time: 10_000 },
        1_800,
        11_799,
      ),
    ).toMatchObject({
      user: { id: "user-123" },
      authenticatedAt: 10_000,
    });
  });

  it.each([
    [{ sub: "user-123" }, "invalid authentication time"],
    [{ sub: "user-123", auth_time: "10000" }, "invalid authentication time"],
    [{ sub: "user-123", auth_time: 10_000 }, "invalid authentication time"],
    [{ sub: "user-123", auth_time: 12_000 }, "invalid authentication time"],
  ])("rejects unusable bounded authentication claims", (claims, message) => {
    expect(() =>
      mapClaimsToAuthenticatedIdentity(claims, 1_800, 11_800),
    ).toThrow(message);
  });

  it("does not allow the request host to influence configured redirects", () => {
    const environment = {
      ACRONYMICON_DEPLOYMENT_PROFILE: "controlled",
      ACRONYMICON_PUBLIC_ORIGIN: "https://app.example.test",
      ACRONYMICON_READ_GROUPS: "dictionary-readers",
      NODE_ENV: "production",
      SESSION_SECRET: "production-session-secret-at-least-32-characters",
      SESSION_ABSOLUTE_TIMEOUT_MINUTES: "480",
      SESSION_INACTIVITY_TIMEOUT_MINUTES: "30",
      SESSION_REAUTHENTICATION_INTERVAL_MINUTES: "60",
      OIDC_ISSUER_URL: "https://issuer.example.test/realms/acronymicon",
      OIDC_CLIENT_ID: "acronymicon",
      OIDC_CLIENT_SECRET: "client-secret",
      OIDC_REDIRECT_URI: "https://app.example.test/auth/callback",
      OIDC_POST_LOGOUT_REDIRECT_URI: "https://app.example.test/",
    };

    for (const [name, value] of Object.entries(environment)) {
      vi.stubEnv(name, value);
    }

    const untrustedRequest = new Request("https://untrusted.example.test/");

    expect(getOidcRedirectUri(untrustedRequest)).toBe(
      "https://app.example.test/auth/callback",
    );
    expect(getOidcPostLogoutRedirectUri(untrustedRequest)).toBe(
      "https://app.example.test/",
    );
  });
});
