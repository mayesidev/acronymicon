import { createCookie, createCookieSessionStorage } from "react-router";

import { getAppConfig } from "../../../platform/config/runtime.server";
import type { AuthUser } from "../model";

type SessionData = {
  user: AuthUser;
  oidcState: string;
  oidcCodeVerifier: string;
  returnTo: string;
};

type SessionFlashData = {
  authError: string;
};

const sessionConfig = getAppConfig().session;

const forceReauthenticationCookie = createCookie(
  "__acronymicon_force_reauthentication",
  {
    httpOnly: true,
    maxAge: 60 * 5,
    path: "/",
    sameSite: "lax",
    secrets: [sessionConfig.secret],
    secure: sessionConfig.secureCookie,
  },
);

export const { getSession, commitSession, destroySession } =
  createCookieSessionStorage<SessionData, SessionFlashData>({
    cookie: {
      name: "__acronymicon_session",
      httpOnly: true,
      maxAge: 60 * 60 * 8,
      path: "/",
      sameSite: "lax",
      secrets: [sessionConfig.secret],
      secure: sessionConfig.secureCookie,
    },
  });

export async function getOptionalUser(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  return session.get("user") ?? null;
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
