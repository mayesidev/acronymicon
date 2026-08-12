import { describe, expect, it } from "vitest";

import { parseAppConfig, parseDatabaseConfig } from "./runtime.server";

describe("application configuration", () => {
  it("applies development defaults without configuring OIDC", () => {
    expect(parseAppConfig({})).toEqual({
      environment: "development",
      deployment: {
        profile: "standard",
        publicOrigin: undefined,
      },
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

  it("accepts a complete controlled deployment configuration", () => {
    expect(
      parseAppConfig({
        ACRONYMICON_DEPLOYMENT_PROFILE: "controlled",
        ACRONYMICON_PUBLIC_ORIGIN: "https://app.example.test",
        NODE_ENV: "production",
        SESSION_SECRET: "production-secret",
        OIDC_ISSUER_URL: "https://issuer.example.test/realms/acronymicon",
        OIDC_CLIENT_ID: "acronymicon",
        OIDC_CLIENT_SECRET: "client-secret",
        OIDC_REDIRECT_URI: "https://app.example.test/auth/callback",
        OIDC_POST_LOGOUT_REDIRECT_URI: "https://app.example.test/",
      }),
    ).toMatchObject({
      environment: "production",
      deployment: {
        profile: "controlled",
        publicOrigin: "https://app.example.test",
      },
      session: { secureCookie: true },
      oidc: { allowInsecureHttp: false },
    });
  });

  it.each([
    [{ NODE_ENV: "development" }, "NODE_ENV must be production"],
    [
      { ACRONYMICON_PUBLIC_ORIGIN: "http://app.example.test" },
      "ACRONYMICON_PUBLIC_ORIGIN must use HTTPS",
    ],
    [
      { SESSION_COOKIE_SECURE: "false" },
      "SESSION_COOKIE_SECURE cannot be false",
    ],
    [
      { OIDC_ALLOW_INSECURE_HTTP: "true" },
      "OIDC_ALLOW_INSECURE_HTTP cannot be true",
    ],
    [
      { OIDC_ISSUER_URL: "http://issuer.example.test/realms/acronymicon" },
      "OIDC_ISSUER_URL must use HTTPS",
    ],
    [
      { OIDC_REDIRECT_URI: "https://other.example.test/auth/callback" },
      "OIDC_REDIRECT_URI must use ACRONYMICON_PUBLIC_ORIGIN",
    ],
  ])("rejects an unsafe controlled-profile override", (override, message) => {
    expect(() =>
      parseAppConfig({
        ACRONYMICON_DEPLOYMENT_PROFILE: "controlled",
        ACRONYMICON_PUBLIC_ORIGIN: "https://app.example.test",
        NODE_ENV: "production",
        SESSION_SECRET: "production-secret",
        OIDC_ISSUER_URL: "https://issuer.example.test/realms/acronymicon",
        OIDC_CLIENT_ID: "acronymicon",
        OIDC_CLIENT_SECRET: "client-secret",
        OIDC_REDIRECT_URI: "https://app.example.test/auth/callback",
        OIDC_POST_LOGOUT_REDIRECT_URI: "https://app.example.test/",
        ...override,
      }),
    ).toThrow(message);
  });

  it("requires explicit identity and application origins in the controlled profile", () => {
    expect(() =>
      parseAppConfig({
        ACRONYMICON_DEPLOYMENT_PROFILE: "controlled",
        NODE_ENV: "production",
        SESSION_SECRET: "production-secret",
      }),
    ).toThrow(
      "ACRONYMICON_PUBLIC_ORIGIN is required for the controlled deployment profile",
    );
  });

  it("rejects a public origin with request components beyond the origin", () => {
    expect(() =>
      parseAppConfig({
        ACRONYMICON_PUBLIC_ORIGIN: "https://app.example.test/application",
      }),
    ).toThrow("must contain only a URL origin");
  });
});

describe("database-only configuration", () => {
  it("applies the shared database defaults in production without app settings", () => {
    expect(parseDatabaseConfig({ NODE_ENV: "production" })).toEqual({
      path: "./data/acronymicon.sqlite",
      migrationsFolder: "./drizzle",
      runMigrations: true,
    });
  });

  it("parses explicit database settings without validating unrelated OIDC", () => {
    expect(
      parseDatabaseConfig({
        NODE_ENV: "production",
        DATABASE_PATH: "/data/acronymicon.sqlite",
        DRIZZLE_MIGRATIONS_PATH: "/app/drizzle",
        RUN_MIGRATIONS_ON_STARTUP: "false",
        OIDC_CLIENT_ID: "partial-configuration-is-not-consumed",
      }),
    ).toEqual({
      path: "/data/acronymicon.sqlite",
      migrationsFolder: "/app/drizzle",
      runMigrations: false,
    });
  });

  it("rejects ambiguous database boolean values", () => {
    expect(() =>
      parseDatabaseConfig({ RUN_MIGRATIONS_ON_STARTUP: "yes" }),
    ).toThrow("Invalid database configuration");
  });
});
