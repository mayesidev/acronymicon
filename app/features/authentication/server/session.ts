import {
  createCookie,
  createCookieSessionStorage,
  createSessionStorage,
} from "react-router";

import { getAppConfig } from "../../../platform/config/runtime.server";
import { getAppDatabase } from "../../../platform/database/lifecycle.server";
import { createDatabaseSessionRepository } from "../../../platform/database/session-repository.server";
import type { AuthUser } from "../model";

type AuthenticatedSessionData = {
  user: AuthUser;
  authenticatedAt?: number;
};

type AuthenticationFlowData = {
  oidcState: string;
  oidcCodeVerifier: string;
  oidcMaxAgeSeconds?: number;
  authenticationPurpose: "login" | "reauthenticate";
  returnTo: string;
};

type AuthenticationFlowFlashData = {
  authError: string;
};

const sessionConfig = getAppConfig().session;
const sessionSecrets = getSessionSecrets(sessionConfig);
const authenticatedSessionMaxAge = getAuthenticatedSessionMaxAge(sessionConfig);

const authenticationFlowStorage = createCookieSessionStorage<
  AuthenticationFlowData,
  AuthenticationFlowFlashData
>({
  cookie: {
    name: "__acronymicon_authentication_flow",
    httpOnly: true,
    maxAge: 60 * 5,
    path: "/",
    sameSite: "lax",
    secrets: sessionSecrets,
    secure: sessionConfig.secureCookie,
  },
});

export const {
  getSession: getAuthenticationFlowSession,
  commitSession: commitAuthenticationFlowSession,
  destroySession: destroyAuthenticationFlowSession,
} = authenticationFlowStorage;

const forceReauthenticationCookie = createCookie(
  "__acronymicon_force_reauthentication",
  {
    httpOnly: true,
    maxAge: 60 * 5,
    path: "/",
    sameSite: "lax",
    secrets: sessionSecrets,
    secure: sessionConfig.secureCookie,
  },
);

export const { getSession, commitSession, destroySession } =
  createSessionStorage<AuthenticatedSessionData>({
    cookie: {
      name: "__acronymicon_session",
      httpOnly: true,
      maxAge: authenticatedSessionMaxAge,
      path: "/",
      sameSite: "lax",
      secrets: sessionSecrets,
      secure: sessionConfig.secureCookie,
    },
    async createData(data, expires) {
      return getSessionRepository().create(data, requireExpiration(expires));
    },
    async readData(id) {
      if (typeof id !== "string") {
        return null;
      }

      return getSessionRepository().read(id);
    },
    async updateData(id, data, expires) {
      if (typeof id !== "string") {
        return;
      }

      await getSessionRepository().update(id, data, requireExpiration(expires));
    },
    async deleteData(id) {
      if (typeof id !== "string") {
        return;
      }

      await getSessionRepository().delete(id);
    },
  });

export async function getOptionalUser(request: Request) {
  return (await getAuthenticatedSession(request)).user;
}

export async function getAuthenticatedSession(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));

  return {
    session,
    user: session.get("user") ?? null,
    authenticatedAt: session.get("authenticatedAt"),
  };
}

export function isReauthenticationDue(
  authentication: Readonly<{
    user: AuthUser | null;
    authenticatedAt?: number;
  }>,
  intervalMinutes: number | undefined,
  nowSeconds = Math.floor(Date.now() / 1_000),
) {
  if (!authentication.user || intervalMinutes === undefined) {
    return false;
  }

  const authenticatedAt = authentication.authenticatedAt;

  return (
    typeof authenticatedAt !== "number" ||
    !Number.isInteger(authenticatedAt) ||
    authenticatedAt < 0 ||
    authenticatedAt > nowSeconds + 60 ||
    nowSeconds >= authenticatedAt + intervalMinutes * 60
  );
}

export async function createForceReauthenticationCookie() {
  return forceReauthenticationCookie.serialize(true);
}

export async function hasForceReauthentication(request: Request) {
  return (
    (await forceReauthenticationCookie.parse(request.headers.get("Cookie"))) ===
    true
  );
}

export async function clearForceReauthenticationCookie() {
  return forceReauthenticationCookie.serialize("", { maxAge: 0 });
}

export function getSessionSecrets(config: {
  secret: string;
  previousSecrets: string[];
}) {
  return [config.secret, ...config.previousSecrets];
}

export function getAuthenticatedSessionMaxAge(config: {
  absoluteTimeoutMinutes: number;
}) {
  return config.absoluteTimeoutMinutes * 60;
}

function getSessionRepository() {
  return createDatabaseSessionRepository(getAppDatabase(), {
    absoluteTimeoutMilliseconds:
      sessionConfig.absoluteTimeoutMinutes * 60 * 1_000,
    inactivityTimeoutMilliseconds:
      sessionConfig.inactivityTimeoutMinutes * 60 * 1_000,
  });
}

function requireExpiration(expires: Date | undefined) {
  if (!expires) {
    throw new Error("Authenticated sessions require an expiration time.");
  }

  return expires;
}
