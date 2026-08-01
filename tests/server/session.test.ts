import { describe, expect, it } from "vitest";

import {
  commitSession,
  destroySession,
  getSession,
} from "../../app/auth/session.server";

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
});
