import { describe, expect, it } from "vitest";

import { parseAppConfig } from "./runtime.server";

describe("application configuration", () => {
  it("applies development defaults without configuring OIDC", () => {
    expect(parseAppConfig({})).toEqual({
      environment: "development",
      database: {
        path: "./data/acronymicon.sqlite",
        migrationsFolder: "./drizzle",
        runMigrations: true,
      },
      session: {
        secret: "dev-session-secret-change-me",
        secureCookie: false,
      },
      oidc: null,
    });
  });

  it("parses explicit booleans and a coherent OIDC configuration", () => {
    expect(
      parseAppConfig({
        NODE_ENV: "production",
        DATABASE_PATH: "/data/acronymicon.sqlite",
        DRIZZLE_MIGRATIONS_PATH: "/app/drizzle",
        RUN_MIGRATIONS_ON_STARTUP: "false",
        SESSION_SECRET: "production-secret",
        SESSION_COOKIE_SECURE: "false",
        OIDC_ISSUER_URL: "https://issuer.example.test/realms/acronymicon",
        OIDC_CLIENT_ID: "acronymicon",
        OIDC_CLIENT_SECRET: "client-secret",
        OIDC_REDIRECT_URI: "https://app.example.test/auth/callback",
        OIDC_POST_LOGOUT_REDIRECT_URI: "https://app.example.test/",
        OIDC_ALLOW_INSECURE_HTTP: "true",
        OIDC_CLAIM_USERNAME: "upn",
      }),
    ).toMatchObject({
      environment: "production",
      database: {
        path: "/data/acronymicon.sqlite",
        migrationsFolder: "/app/drizzle",
        runMigrations: false,
      },
      session: { secret: "production-secret", secureCookie: false },
      oidc: {
        issuerUrl: "https://issuer.example.test/realms/acronymicon",
        clientId: "acronymicon",
        redirectUri: "https://app.example.test/auth/callback",
        postLogoutRedirectUri: "https://app.example.test/",
        scopes: "openid profile email",
        allowInsecureHttp: true,
        claims: {
          userId: "sub",
          username: "upn",
          email: "email",
          groups: "groups",
        },
      },
    });
  });

  it("requires a session secret in production", () => {
    expect(() => parseAppConfig({ NODE_ENV: "production" })).toThrow(
      "SESSION_SECRET is required in production",
    );
  });

  it("rejects partial OIDC credentials", () => {
    expect(() =>
      parseAppConfig({ OIDC_CLIENT_ID: "acronymicon" }),
    ).toThrow("OIDC_ISSUER_URL is required when OIDC is configured");
  });

  it("rejects ambiguous boolean values", () => {
    expect(() =>
      parseAppConfig({ RUN_MIGRATIONS_ON_STARTUP: "yes" }),
    ).toThrow("RUN_MIGRATIONS_ON_STARTUP");
  });
});
