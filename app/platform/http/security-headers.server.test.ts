import { describe, expect, it } from "vitest";

import { parseAppConfig } from "../config/runtime.server";
import { applyDeploymentSecurityHeaders } from "./security-headers.server";

describe("deployment security headers", () => {
  it("applies protected response defaults in the controlled profile", () => {
    const headers = applyDeploymentSecurityHeaders(
      new Headers({ "Content-Type": "text/html" }),
      controlledConfig(),
    );

    expect(Object.fromEntries(headers)).toMatchObject({
      "cache-control": "no-store",
      "content-security-policy":
        "base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
      "content-type": "text/html",
      "referrer-policy": "no-referrer",
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    });
  });

  it("does not change response headers in the standard profile", () => {
    const headers = new Headers({ "Cache-Control": "public, max-age=60" });

    expect(applyDeploymentSecurityHeaders(headers, parseAppConfig({}))).toBe(
      headers,
    );
    expect(headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(headers.has("Strict-Transport-Security")).toBe(false);
  });
});

function controlledConfig() {
  return parseAppConfig({
    ACRONYMICON_DEPLOYMENT_PROFILE: "controlled",
    ACRONYMICON_PUBLIC_ORIGIN: "https://app.example.test",
    ACRONYMICON_READ_GROUPS: "dictionary-readers",
    NODE_ENV: "production",
    SESSION_SECRET: "production-session-secret-at-least-32-characters",
    SESSION_ABSOLUTE_TIMEOUT_MINUTES: "480",
    SESSION_INACTIVITY_TIMEOUT_MINUTES: "30",
    OIDC_ISSUER_URL: "https://issuer.example.test/realms/acronymicon",
    OIDC_CLIENT_ID: "acronymicon",
    OIDC_CLIENT_SECRET: "client-secret",
    OIDC_REDIRECT_URI: "https://app.example.test/auth/callback",
    OIDC_POST_LOGOUT_REDIRECT_URI: "https://app.example.test/",
  });
}
