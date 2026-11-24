import * as oidcClient from "openid-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getOidcCallbackUrl,
  getOidcPostLogoutRedirectUri,
  getOidcRedirectUri,
  mapClaimsToUser,
  mapClaimsToAuthenticatedIdentity,
} from "./oidc";

vi.mock(import("openid-client"), async (importOriginal) => ({
  ...(await importOriginal()),
  authorizationCodeGrant: vi.fn(),
  discovery: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OIDC claims and redirect helpers", () => {
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

  it("accepts claims just inside the maximum authentication age", () => {
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
      ACRONYMICON_ACCESS_NOTICE: "Authorized access only.",
      ACRONYMICON_SENSITIVITY_LABEL: "Controlled content",
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
    expect(
      getOidcCallbackUrl(
        new Request("http://localhost:3103/auth/callback?state=opaque&code=token"),
      ).toString(),
    ).toBe("https://app.example.test/auth/callback?state=opaque&code=token");

    vi.stubEnv("ACRONYMICON_PUBLIC_ORIGIN", "https://app.example.test:8443");
    vi.stubEnv("OIDC_REDIRECT_URI", "https://app.example.test:8443/auth/callback");
    vi.stubEnv("OIDC_POST_LOGOUT_REDIRECT_URI", "https://app.example.test:8443/");
    expect(
      getOidcCallbackUrl(
        new Request("http://localhost:3103/auth/callback?state=opaque"),
      ).toString(),
    ).toBe("https://app.example.test:8443/auth/callback?state=opaque");
  });

  it("keeps the request URL when no public origin is configured", () => {
    expect(
      getOidcCallbackUrl(
        new Request("http://localhost:3100/auth/callback?state=opaque"),
      ).toString(),
    ).toBe("http://localhost:3100/auth/callback?state=opaque");
  });
});

describe("OIDC client adapter", () => {
  const issuer = "https://issuer.example.test/realms/acronymicon";
  const clientId = "acronymicon-test";
  const publicOrigin = "https://app.example.test:8443";
  const callbackUri = `${publicOrigin}/auth/callback`;
  const authorizationEndpoint = "https://issuer.example.test/authorize";
  const logoutEndpoint = "https://issuer.example.test/logout";
  const codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
  const grantInput = {
    request: new Request(
      "http://internal.example.test:3000/auth/callback?code=test-code&state=test-state",
    ),
    expectedState: "test-state",
    codeVerifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    maxAgeSeconds: 1_800,
  };
  const authorizationInput = {
    request: new Request("http://internal.example.test:3000/auth/login"),
    state: grantInput.expectedState,
    codeVerifier: grantInput.codeVerifier,
    forceReauthentication: true,
    maxAgeSeconds: grantInput.maxAgeSeconds,
  };

  let adapter: typeof import("./oidc");
  let providerConfig: oidcClient.Configuration;
  let runtimeConfig: typeof import("../../../platform/config/runtime.server");

  function mockGrantClaims(
    claims: ReturnType<oidcClient.TokenEndpointResponseHelpers["claims"]>,
  ) {
    const token = { access_token: "test-access-token", token_type: "bearer" as const };
    const helpers: oidcClient.TokenEndpointResponseHelpers = {
      claims: () => claims,
      expiresIn: () => undefined,
    };
    vi.mocked(oidcClient.authorizationCodeGrant).mockResolvedValue(
      Object.assign(token, helpers) as Awaited<
        ReturnType<typeof oidcClient.authorizationCodeGrant>
      >,
    );
  }

  beforeEach(async () => {
    vi.resetModules();
    runtimeConfig = await import("../../../platform/config/runtime.server");
    vi.spyOn(runtimeConfig, "getAppConfig").mockReturnValue(
      runtimeConfig.parseAppConfig({
        NODE_ENV: "test",
        ACRONYMICON_PUBLIC_ORIGIN: publicOrigin,
        OIDC_ISSUER_URL: issuer,
        OIDC_CLIENT_ID: clientId,
        OIDC_CLIENT_SECRET: "fake-client-secret",
      }),
    );
    providerConfig = new oidcClient.Configuration(
      {
        issuer,
        authorization_endpoint: authorizationEndpoint,
        end_session_endpoint: logoutEndpoint,
      },
      clientId,
    );
    vi.mocked(oidcClient.discovery).mockResolvedValue(providerConfig);
    adapter = await import("./oidc");
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("builds a sign-in URL with state, S256 PKCE and reauthentication parameters", async () => {
    const url = await adapter.buildAuthorizationUrl(authorizationInput);

    expect(`${url.origin}${url.pathname}`).toBe(authorizationEndpoint);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: clientId,
      response_type: "code",
      redirect_uri: callbackUri,
      scope: "openid profile email",
      state: grantInput.expectedState,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      max_age: "1800",
      prompt: "login",
    });
  });

  it("exchanges the code with the expected checks and canonical callback URLs", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const issuedAt = now.getTime() / 1_000;
    const authenticatedAt = issuedAt - 60;
    mockGrantClaims({
      iss: issuer,
      aud: clientId,
      sub: "test-user",
      iat: issuedAt,
      exp: issuedAt + 300,
      auth_time: authenticatedAt,
    });

    await expect(
      adapter.completeAuthorizationCodeGrant(grantInput),
    ).resolves.toMatchObject({
      user: { id: "test-user" },
      authenticatedAt,
    });
    expect(oidcClient.authorizationCodeGrant).toHaveBeenCalledExactlyOnceWith(
      providerConfig,
      new URL(`${callbackUri}?code=test-code&state=test-state`),
      {
        expectedState: grantInput.expectedState,
        pkceCodeVerifier: grantInput.codeVerifier,
        maxAge: grantInput.maxAgeSeconds,
      },
      { redirect_uri: callbackUri },
    );
  });

  it("rejects a token response without ID-token claims", async () => {
    mockGrantClaims(undefined);

    await expect(
      adapter.completeAuthorizationCodeGrant(grantInput),
    ).rejects.toThrow(/^OIDC provider did not return an ID token\.$/);
  });

  it("does not call the provider when OIDC is unconfigured", async () => {
    vi.mocked(runtimeConfig.getAppConfig).mockReturnValue(
      runtimeConfig.parseAppConfig({ NODE_ENV: "test" }),
    );

    await expect(
      adapter.buildAuthorizationUrl(authorizationInput),
    ).rejects.toThrow(/^OIDC is not configured\.$/);
    await expect(
      adapter.completeAuthorizationCodeGrant(grantInput),
    ).rejects.toThrow(/^OIDC is not configured\.$/);
    await expect(adapter.buildOidcLogoutUrl(grantInput)).resolves.toBeNull();
    expect(oidcClient.discovery).not.toHaveBeenCalled();
    expect(oidcClient.authorizationCodeGrant).not.toHaveBeenCalled();
  });

  it("fails sign-in but allows local logout when provider discovery rejects", async () => {
    const discoveryError = new Error("Test provider discovery failed");
    vi.mocked(oidcClient.discovery).mockRejectedValue(discoveryError);

    await expect(adapter.buildAuthorizationUrl(authorizationInput)).rejects.toBe(
      discoveryError,
    );
    await expect(
      adapter.completeAuthorizationCodeGrant(grantInput),
    ).rejects.toBe(discoveryError);
    await expect(adapter.buildOidcLogoutUrl(grantInput)).resolves.toBeNull();
    expect(oidcClient.authorizationCodeGrant).not.toHaveBeenCalled();
  });

  it("allows local logout when discovery returns no end-session endpoint", async () => {
    vi.mocked(oidcClient.discovery).mockResolvedValue(
      new oidcClient.Configuration({ issuer }, clientId),
    );

    await expect(adapter.buildOidcLogoutUrl(grantInput)).resolves.toBeNull();
  });

  it("builds a provider logout URL with the canonical post-logout redirect", async () => {
    const url = await adapter.buildOidcLogoutUrl(grantInput);

    expect(url).not.toBeNull();
    expect(`${url?.origin}${url?.pathname}`).toBe(logoutEndpoint);
    expect(url?.searchParams.get("post_logout_redirect_uri")).toBe(
      `${publicOrigin}/`,
    );
    expect(url?.searchParams.get("client_id")).toBe(clientId);
  });
});
