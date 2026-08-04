import { describe, expect, it } from "vitest";

import {
  addReauthenticationPrompt,
  mapClaimsToUser,
} from "./oidc.server";

describe("OIDC claim mapping", () => {
  it("maps configured identity claims and group membership", () => {
    expect(
      mapClaimsToUser({
        sub: "user-123",
        preferred_username: "local-user",
        name: "Local User",
        email: "user@example.test",
        groups: ["acronymicon-admin"],
      }),
    ).toEqual({
      id: "user-123",
      username: "local-user",
      displayName: "Local User",
      email: "user@example.test",
      groups: ["acronymicon-admin"],
    });
  });

  it("rejects claims without a stable identifier", () => {
    expect(() => mapClaimsToUser({ name: "Missing Subject" })).toThrow(
      "stable user identifier",
    );
  });

  it("requests provider reauthentication after an explicit logout", () => {
    const authorizationUrl = addReauthenticationPrompt(
      new URL("https://issuer.example.test/authorize?client_id=acronymicon"),
      true,
    );

    expect(authorizationUrl.searchParams.get("prompt")).toBe("login");
  });
});
