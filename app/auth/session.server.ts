import { createCookie, createCookieSessionStorage } from "react-router";

export type AuthUser = {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  groups: string[];
};

type SessionData = {
  user: AuthUser;
  oidcState: string;
  oidcCodeVerifier: string;
  returnTo: string;
};

type SessionFlashData = {
  authError: string;
};

const sessionSecret =
  process.env.SESSION_SECRET ??
  (process.env.NODE_ENV === "production"
    ? undefined
    : "dev-session-secret-change-me");

if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required in production.");
}

const secureCookie =
  process.env.SESSION_COOKIE_SECURE ??
  (process.env.NODE_ENV === "production" ? "true" : "false");

const forceReauthenticationCookie = createCookie(
  "__acronymicon_force_reauthentication",
  {
    httpOnly: true,
    maxAge: 60 * 5,
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: secureCookie !== "false",
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
      secrets: [sessionSecret],
      secure: secureCookie !== "false",
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
    (await forceReauthenticationCookie.parse(
      request.headers.get("Cookie"),
    )) === true
  );
}

export async function clearForceReauthenticationCookie() {
  return forceReauthenticationCookie.serialize("", { maxAge: 0 });
}
