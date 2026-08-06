import { describe, expect, it } from "vitest";

import {
  clearForceReauthenticationCookie,
  commitSession,
  createForceReauthenticationCookie,
  destroySession,
  getSession,
  hasForceReauthentication,
} from "./session";

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

    expect(restored.get("user")).toMatchObject({
      id: "user-123",
      username: "local-user",
    });
    expect(await destroySession(restored)).toContain("Expires=Thu, 01 Jan 1970");
  });

  it("round-trips the short-lived reauthentication marker", async () => {
    const marker = await createForceReauthenticationCookie();
    const request = new Request("http://localhost:5173/auth/login", {
      headers: { Cookie: marker },
    });

    expect(await hasForceReauthentication(request)).toBe(true);
    expect(await clearForceReauthenticationCookie()).toContain(
      "Max-Age=0",
    );
  });
});
