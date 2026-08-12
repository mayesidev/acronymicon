import * as oidc from "openid-client";

import { getAppConfig } from "../../../platform/config/runtime.server";
import type { AuthUser } from "../model";

let cachedConfig: Promise<oidc.Configuration | null> | null = null;

export function isOidcConfigured() {
  return getAppConfig().oidc !== null;
}

export async function getOidcConfig() {
  if (!cachedConfig) {
    cachedConfig = discoverOidcConfig();
  }

  return cachedConfig;
}

export function getOidcRedirectUri(request: Request) {
  const config = getAppConfig();

  return new URL(
    config.oidc?.redirectUri ?? "/auth/callback",
    config.deployment.publicOrigin ?? request.url,
  ).toString();
}

export function getOidcPostLogoutRedirectUri(request: Request) {
  const config = getAppConfig();

  return new URL(
    config.oidc?.postLogoutRedirectUri ?? "/",
    config.deployment.publicOrigin ?? request.url,
  ).toString();
}

export function getOidcScopes() {
  return getAppConfig().oidc?.scopes ?? "openid profile email";
}

export async function buildAuthorizationUrl(input: {
  request: Request;
  state: string;
  codeVerifier: string;
  forceReauthentication?: boolean;
}) {
  const config = await getOidcConfig();

  if (!config) {
    throw new Error("OIDC is not configured.");
  }

  const codeChallenge = await oidc.calculatePKCECodeChallenge(
    input.codeVerifier,
  );

  const authorizationUrl = oidc.buildAuthorizationUrl(config, {
    redirect_uri: getOidcRedirectUri(input.request),
    scope: getOidcScopes(),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: input.state,
  });

  return addReauthenticationPrompt(
    authorizationUrl,
    input.forceReauthentication,
  );
}

export function addReauthenticationPrompt(
  authorizationUrl: URL,
  forceReauthentication = false,
) {
  if (forceReauthentication) {
    authorizationUrl.searchParams.set("prompt", "login");
  }

  return authorizationUrl;
}

export async function buildOidcLogoutUrl(input: { request: Request }) {
  try {
    const config = await getOidcConfig();

    if (!config || !config.serverMetadata().end_session_endpoint) {
      return null;
    }

    return oidc.buildEndSessionUrl(config, {
      post_logout_redirect_uri: getOidcPostLogoutRedirectUri(input.request),
    });
  } catch {
    // Local session destruction remains the fallback when provider logout is unavailable.
    return null;
  }
}

export async function completeAuthorizationCodeGrant(input: {
  request: Request;
  expectedState: string;
  codeVerifier: string;
}) {
  const config = await getOidcConfig();

  if (!config) {
    throw new Error("OIDC is not configured.");
  }

  const tokens = await oidc.authorizationCodeGrant(
    config,
    new URL(input.request.url),
    {
      expectedState: input.expectedState,
      pkceCodeVerifier: input.codeVerifier,
    },
    {
      redirect_uri: getOidcRedirectUri(input.request),
    },
  );

  const claims = tokens.claims();

  if (!claims) {
    throw new Error("OIDC provider did not return an ID token.");
  }

  return mapClaimsToUser(claims);
}

export function randomOidcState() {
  return oidc.randomState();
}

export function randomOidcCodeVerifier() {
  return oidc.randomPKCECodeVerifier();
}

async function discoverOidcConfig() {
  const config = getAppConfig().oidc;

  if (!config) {
    return null;
  }

  return oidc.discovery(
    new URL(config.issuerUrl),
    config.clientId,
    config.clientSecret,
    undefined,
    config.allowInsecureHttp
      ? { execute: [oidc.allowInsecureRequests] }
      : undefined,
  );
}

export function mapClaimsToUser(claims: Record<string, unknown>): AuthUser {
  const claimConfig = getAppConfig().oidc?.claims ?? {
    userId: "sub",
    username: undefined,
    displayName: undefined,
    email: "email",
    groups: "groups",
  };
  const id = getClaimString(claims, claimConfig.userId);

  if (!id) {
    throw new Error("OIDC claims did not include a stable user identifier.");
  }

  return {
    id,
    username:
      getFirstClaimString(claims, [
        claimConfig.username,
        "preferred_username",
        "upn",
        "email",
        "name",
        "sub",
      ]) ?? id,
    displayName: getFirstClaimString(claims, [claimConfig.displayName, "name"]),
    email: getClaimString(claims, claimConfig.email),
    groups: getClaimStringArray(claims, claimConfig.groups),
  };
}

function getFirstClaimString(
  claims: Record<string, unknown>,
  claimNames: Array<string | undefined>,
) {
  for (const claimName of claimNames) {
    if (!claimName) {
      continue;
    }

    const value = getClaimString(claims, claimName);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function getClaimString(claims: Record<string, unknown>, claimName: string) {
  const value = claims[claimName];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getClaimStringArray(
  claims: Record<string, unknown>,
  claimName: string,
) {
  const value = claims[claimName];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
