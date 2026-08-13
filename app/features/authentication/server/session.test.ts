import { describe, expect, it } from "vitest";
import { createCookieSessionStorage } from "react-router";

import {
  clearForceReauthenticationCookie,
  commitSession,
  createForceReauthenticationCookie,
  destroySession,
  getAuthenticatedSessionMaxAge,
  getSession,
  getSessionSecrets,
  hasForceReauthentication,
} from "./session";

function createTestStorage(secrets: string[]) {
  return createCookieSessionStorage<{ marker: string }>({
    cookie: {
      name: "rotation_test",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secrets,
    },
  });
}

describe("session lifecycle", () => {
  it("round-trips a user and expires the cookie on destruction", async () => {
    const session = await getSession(null);
    session.set("user", {
      id: "user-123",
      username: "local-user",
      groups: [],
    });

    const cookie = await commitSession(session);
    const restored = await getSession(cookie);

    const encodedIdentifier = decodeURIComponent(
      cookie.match(/__acronymicon_session=([^;]+)/)?.[1] ?? "",
    ).split(".")[0];
    const browserPayload = JSON.parse(
      Buffer.from(encodedIdentifier, "base64").toString("utf8"),
    ) as unknown;

    expect(cookie).not.toContain("local-user");
    expect(cookie).toContain("Max-Age=28800");
    expect(browserPayload).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    expect(restored.get("user")).toMatchObject({
      id: "user-123",
      username: "local-user",
    });
    expect(await destroySession(restored)).toContain(
      "Expires=Thu, 01 Jan 1970",
    );

    const revoked = await getSession(cookie);
    expect(revoked.get("user")).toBeUndefined();
  });

  it("round-trips the short-lived reauthentication marker", async () => {
    const marker = await createForceReauthenticationCookie();
    const request = new Request("http://localhost:5173/auth/login", {
      headers: { Cookie: marker },
    });

    expect(await hasForceReauthentication(request)).toBe(true);
    expect(await clearForceReauthenticationCookie()).toContain("Max-Age=0");
  });

  it("safely ignores the legacy browser-owned session format", async () => {
    const legacyStorage = createCookieSessionStorage<{
      user: { id: string; username: string; groups: string[] };
    }>({
      cookie: {
        name: "__acronymicon_session",
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secrets: ["vitest-session-secret"],
      },
    });
    const legacySession = await legacyStorage.getSession();
    legacySession.set("user", {
      id: "legacy-user",
      username: "legacy-user",
      groups: [],
    });
    const legacyCookie = await legacyStorage.commitSession(legacySession);

    const ignored = await getSession(legacyCookie);
    expect(ignored.get("user")).toBeUndefined();
    await expect(destroySession(ignored)).resolves.toContain(
      "Expires=Thu, 01 Jan 1970",
    );
  });

  it("accepts an old cookie during rotation and signs new cookies with the active secret", async () => {
    const oldStorage = createTestStorage(["old-secret"]);
    const rotatingStorage = createTestStorage(["new-secret", "old-secret"]);
    const activeOnlyStorage = createTestStorage(["new-secret"]);

    const oldSession = await oldStorage.getSession();
    oldSession.set("marker", "old-cookie");
    const oldCookie = await oldStorage.commitSession(oldSession);

    expect((await rotatingStorage.getSession(oldCookie)).get("marker")).toBe(
      "old-cookie",
    );

    const newSession = await rotatingStorage.getSession();
    newSession.set("marker", "new-cookie");
    const newCookie = await rotatingStorage.commitSession(newSession);

    expect((await activeOnlyStorage.getSession(newCookie)).get("marker")).toBe(
      "new-cookie",
    );
    expect(
      (await oldStorage.getSession(newCookie)).get("marker"),
    ).toBeUndefined();
    expect(
      (await activeOnlyStorage.getSession(oldCookie)).get("marker"),
    ).toBeUndefined();
  });

  it("orders the active secret before rotation predecessors", () => {
    expect(
      getSessionSecrets({
        secret: "active",
        previousSecrets: ["previous", "oldest"],
      }),
    ).toEqual(["active", "previous", "oldest"]);
  });

  it("converts the configured absolute lifetime to cookie seconds", () => {
    expect(getAuthenticatedSessionMaxAge({ absoluteTimeoutMinutes: 30 })).toBe(
      1_800,
    );
  });
});
