import * as oidc from "openid-client";

import type { AuthUser } from "./session.server";

let cachedConfig: Promise<oidc.Configuration | null> | null = null;

export function isOidcConfigured() {
  return Boolean(
    process.env.OIDC_ISSUER_URL &&
      process.env.OIDC_CLIENT_ID &&
      process.env.OIDC_CLIENT_SECRET,
  );
}

export async function getOidcConfig() {
  if (!cachedConfig) {
    cachedConfig = discoverOidcConfig();
  }

  return cachedConfig;
}

export function getOidcRedirectUri(request: Request) {
  return (
    process.env.OIDC_REDIRECT_URI ??
    new URL("/auth/callback", request.url).toString()
  );
}

export function getOidcPostLogoutRedirectUri(request: Request) {
  return (
    process.env.OIDC_POST_LOGOUT_REDIRECT_URI ||
    new URL("/", request.url).toString()
  );
}

export function getOidcScopes() {
  return process.env.OIDC_SCOPES ?? "openid profile email";
}

export async function buildAuthorizationUrl(input: {
  request: Request;
  state: string;
  codeVerifier: string;
}) {
  const config = await getOidcConfig();

  if (!config) {
    throw new Error("OIDC is not configured.");
  }

  const codeChallenge = await oidc.calculatePKCECodeChallenge(
    input.codeVerifier,
  );

  return oidc.buildAuthorizationUrl(config, {
    redirect_uri: getOidcRedirectUri(input.request),
    scope: getOidcScopes(),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: input.state,
  });
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
  if (!isOidcConfigured()) {
    return null;
  }

  return oidc.discovery(
    new URL(requiredEnv("OIDC_ISSUER_URL")),
    requiredEnv("OIDC_CLIENT_ID"),
    requiredEnv("OIDC_CLIENT_SECRET"),
    undefined,
    process.env.OIDC_ALLOW_INSECURE_HTTP === "true"
      ? { execute: [oidc.allowInsecureRequests] }
      : undefined,
  );
}

export function mapClaimsToUser(claims: Record<string, unknown>): AuthUser {
  const id = getClaimString(claims, process.env.OIDC_CLAIM_USER_ID ?? "sub");

  if (!id) {
    throw new Error("OIDC claims did not include a stable user identifier.");
  }

  return {
    id,
    username:
      getFirstClaimString(claims, [
        process.env.OIDC_CLAIM_USERNAME,
        "preferred_username",
        "upn",
        "email",
        "name",
        "sub",
      ]) ?? id,
    displayName: getFirstClaimString(claims, [
      process.env.OIDC_CLAIM_DISPLAY_NAME,
      "name",
    ]),
    email: getClaimString(claims, process.env.OIDC_CLAIM_EMAIL ?? "email"),
    groups: getClaimStringArray(
      claims,
      process.env.OIDC_CLAIM_GROUPS ?? "groups",
    ),
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

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}
