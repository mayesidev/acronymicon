import * as oidc from "openid-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("openid-client"), async (importOriginal) => ({
  ...(await importOriginal()),
  authorizationCodeGrant: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  buildEndSessionUrl: vi.fn(),
  calculatePKCECodeChallenge: vi.fn(),
  discovery: vi.fn(),
}));

const issuer = "https://issuer.example.test/realms/acronymicon";
const clientId = "acronymicon-test";
const publicOrigin = "https://app.example.test:8443";
const callbackUri = `${publicOrigin}/auth/callback`;
const logoutEndpoint = "https://issuer.example.test/logout";
const grantInput = {
  request: new Request(
    "http://internal.example.test:3000/auth/callback?code=test-code&state=test-state",
  ),
  expectedState: "test-state",
  codeVerifier: "test-code-verifier",
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
    { issuer, end_session_endpoint: logoutEndpoint },
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
    vi.mocked(oidc.calculatePKCECodeChallenge).mockResolvedValue("test-challenge");
    vi.mocked(oidc.buildAuthorizationUrl).mockReturnValue(
      new URL("https://issuer.example.test/authorize"),
    );

    const url = await adapter.buildAuthorizationUrl(authorizationInput);

    expect(oidc.calculatePKCECodeChallenge).toHaveBeenCalledExactlyOnceWith(
      grantInput.codeVerifier,
    );
    expect(oidc.buildAuthorizationUrl).toHaveBeenCalledExactlyOnceWith(
      providerConfig,
      {
        redirect_uri: callbackUri,
        scope: "openid profile email",
        state: grantInput.expectedState,
        code_challenge: "test-challenge",
        code_challenge_method: "S256",
      },
    );
    expect(url.searchParams.get("max_age")).toBe("1800");
    expect(url.searchParams.get("prompt")).toBe("login");
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
    expect(oidc.buildAuthorizationUrl).not.toHaveBeenCalled();
    expect(oidc.authorizationCodeGrant).not.toHaveBeenCalled();
    expect(oidc.buildEndSessionUrl).not.toHaveBeenCalled();
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
    expect(oidc.buildAuthorizationUrl).not.toHaveBeenCalled();
    expect(oidc.authorizationCodeGrant).not.toHaveBeenCalled();
    expect(oidc.buildEndSessionUrl).not.toHaveBeenCalled();
  });

  it("allows local logout when discovery returns no end-session endpoint", async () => {
    vi.mocked(oidc.discovery).mockResolvedValue(
      new oidc.Configuration({ issuer }, clientId),
    );

    await expect(adapter.buildOidcLogoutUrl(grantInput)).resolves.toBeNull();
    expect(oidc.buildEndSessionUrl).not.toHaveBeenCalled();
  });

  it("passes the canonical post-logout redirect to the provider URL builder", async () => {
    const logoutUrl = new URL(logoutEndpoint);
    vi.mocked(oidc.buildEndSessionUrl).mockReturnValue(logoutUrl);

    await expect(adapter.buildOidcLogoutUrl(grantInput)).resolves.toBe(logoutUrl);
    expect(oidc.buildEndSessionUrl).toHaveBeenCalledExactlyOnceWith(
      providerConfig,
      { post_logout_redirect_uri: `${publicOrigin}/` },
    );
  });
});
