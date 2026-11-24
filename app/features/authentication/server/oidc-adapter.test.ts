import * as oidc from "openid-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("openid-client"), async (importOriginal) => ({
  ...(await importOriginal()),
  authorizationCodeGrant: vi.fn(),
  discovery: vi.fn(),
}));

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
let providerConfig: oidc.Configuration;

function mockGrantClaims(
  claims: ReturnType<oidc.TokenEndpointResponseHelpers["claims"]>,
) {
  const token = { access_token: "test-access-token", token_type: "bearer" as const };
  const helpers: oidc.TokenEndpointResponseHelpers = {
    claims: () => claims,
    expiresIn: () => undefined,
  };
  vi.mocked(oidc.authorizationCodeGrant).mockResolvedValue(
    Object.assign(token, helpers) as Awaited<
      ReturnType<typeof oidc.authorizationCodeGrant>
    >,
  );
}

beforeEach(async () => {
  vi.resetModules();
  const runtimeConfig = await import("../../../platform/config/runtime.server");
  vi.spyOn(runtimeConfig, "getAppConfig").mockReturnValue(
    runtimeConfig.parseAppConfig({
      NODE_ENV: "test",
      ACRONYMICON_PUBLIC_ORIGIN: publicOrigin,
      OIDC_ISSUER_URL: issuer,
      OIDC_CLIENT_ID: clientId,
      OIDC_CLIENT_SECRET: "fake-client-secret",
    }),
  );
  providerConfig = new oidc.Configuration(
    {
      issuer,
      authorization_endpoint: authorizationEndpoint,
      end_session_endpoint: logoutEndpoint,
    },
    clientId,
  );
  vi.mocked(oidc.discovery).mockResolvedValue(providerConfig);
  adapter = await import("./oidc");
});

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("OIDC client adapter", () => {
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
    expect(oidc.authorizationCodeGrant).toHaveBeenCalledExactlyOnceWith(
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
    const runtimeConfig = await import("../../../platform/config/runtime.server");
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
    expect(oidc.discovery).not.toHaveBeenCalled();
    expect(oidc.authorizationCodeGrant).not.toHaveBeenCalled();
  });

  it("fails sign-in but allows local logout when provider discovery rejects", async () => {
    const discoveryError = new Error("Test provider discovery failed");
    vi.mocked(oidc.discovery).mockRejectedValue(discoveryError);

    await expect(adapter.buildAuthorizationUrl(authorizationInput)).rejects.toBe(
      discoveryError,
    );
    await expect(
      adapter.completeAuthorizationCodeGrant(grantInput),
    ).rejects.toBe(discoveryError);
    await expect(adapter.buildOidcLogoutUrl(grantInput)).resolves.toBeNull();
    expect(oidc.authorizationCodeGrant).not.toHaveBeenCalled();
  });

  it("allows local logout when discovery returns no end-session endpoint", async () => {
    vi.mocked(oidc.discovery).mockResolvedValue(
      new oidc.Configuration({ issuer }, clientId),
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
