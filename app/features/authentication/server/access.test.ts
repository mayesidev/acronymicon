import { describe, expect, it } from "vitest";

import { parseAppConfig } from "../../../platform/config/runtime.server";
import { commitSession, getSession } from "./session";
import { authorizeDictionaryAccess } from "./access";

describe("dictionary access", () => {
  it("allows anonymous access in the default open mode", async () => {
    await expect(
      authorizeDictionaryAccess(
        new Request("http://localhost/?q=api"),
        parseAppConfig({}),
      ),
    ).resolves.toBeNull();
  });

  it("redirects anonymous document requests to sign in", async () => {
    const response = await authorizeDictionaryAccess(
      new Request("http://localhost/define?acr=API&sort=recent"),
      authenticatedConfig(),
    );

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("Expected dictionary access to redirect.");
    }
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "/auth/login?returnTo=%2Fdefine%3Facr%3DAPI%26sort%3Drecent",
    );
  });

  it("does not use an internal data endpoint as a return destination", async () => {
    const response = await authorizeDictionaryAccess(
      new Request("http://localhost/define.data?acr=API"),
      authenticatedConfig(),
    );

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("Expected dictionary access to redirect.");
    }
    expect(response.headers.get("Location")).toBe(
      "/auth/login?returnTo=%2F",
    );
  });

  it("returns the authenticated user in authenticated mode", async () => {
    const session = await getSession();
    session.set("user", {
      id: "user-123",
      username: "local-user",
      groups: [],
    });
    const request = new Request("http://localhost/", {
      headers: { Cookie: await commitSession(session) },
    });

    await expect(
      authorizeDictionaryAccess(request, authenticatedConfig()),
    ).resolves.toMatchObject({ id: "user-123", username: "local-user" });
  });
});

function authenticatedConfig() {
  return parseAppConfig({
    ACRONYMICON_DICTIONARY_ACCESS: "authenticated",
    OIDC_ISSUER_URL: "http://issuer.example.test/realms/acronymicon",
    OIDC_CLIENT_ID: "acronymicon",
    OIDC_CLIENT_SECRET: "client-secret",
  });
}
