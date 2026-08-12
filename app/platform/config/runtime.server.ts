import { z } from "zod";

const optionalString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.url().optional(),
);

const optionalBoolean = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.enum(["true", "false"]).optional(),
);

const databaseEnvironmentShape = {
  DATABASE_PATH: optionalString,
  DRIZZLE_MIGRATIONS_PATH: optionalString,
  RUN_MIGRATIONS_ON_STARTUP: optionalBoolean,
};

const databaseEnvironmentSchema = z.object(databaseEnvironmentShape);

const applicationEnvironmentSchema = z
  .object({
    ...databaseEnvironmentShape,
    ACRONYMICON_DEPLOYMENT_PROFILE: z
      .enum(["standard", "controlled"])
      .default("standard"),
    ACRONYMICON_PUBLIC_ORIGIN: optionalUrl,
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    SESSION_SECRET: optionalString,
    SESSION_COOKIE_SECURE: optionalBoolean,
    OIDC_ISSUER_URL: optionalUrl,
    OIDC_CLIENT_ID: optionalString,
    OIDC_CLIENT_SECRET: optionalString,
    OIDC_REDIRECT_URI: optionalUrl,
    OIDC_POST_LOGOUT_REDIRECT_URI: optionalUrl,
    OIDC_SCOPES: optionalString,
    OIDC_ALLOW_INSECURE_HTTP: optionalBoolean,
    OIDC_CLAIM_USER_ID: optionalString,
    OIDC_CLAIM_USERNAME: optionalString,
    OIDC_CLAIM_DISPLAY_NAME: optionalString,
    OIDC_CLAIM_EMAIL: optionalString,
    OIDC_CLAIM_GROUPS: optionalString,
  })
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === "production" &&
      !environment.SESSION_SECRET
    ) {
      context.addIssue({
        code: "custom",
        message: "SESSION_SECRET is required in production.",
        path: ["SESSION_SECRET"],
      });
    }

    const oidcValues = Object.entries(environment).filter(
      ([name, value]) => name.startsWith("OIDC_") && value !== undefined,
    );

    if (oidcValues.length > 0) {
      for (const name of [
        "OIDC_ISSUER_URL",
        "OIDC_CLIENT_ID",
        "OIDC_CLIENT_SECRET",
      ] as const) {
        if (!environment[name]) {
          context.addIssue({
            code: "custom",
            message: `${name} is required when OIDC is configured.`,
            path: [name],
          });
        }
      }
    }

    if (
      environment.ACRONYMICON_PUBLIC_ORIGIN &&
      !isUrlOrigin(environment.ACRONYMICON_PUBLIC_ORIGIN)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "ACRONYMICON_PUBLIC_ORIGIN must contain only a URL origin, without credentials, a path, query parameters, or a fragment.",
        path: ["ACRONYMICON_PUBLIC_ORIGIN"],
      });
    }

    if (environment.ACRONYMICON_DEPLOYMENT_PROFILE !== "controlled") {
      return;
    }

    if (environment.NODE_ENV !== "production") {
      context.addIssue({
        code: "custom",
        message:
          "NODE_ENV must be production for the controlled deployment profile.",
        path: ["NODE_ENV"],
      });
    }

    for (const name of [
      "ACRONYMICON_PUBLIC_ORIGIN",
      "OIDC_ISSUER_URL",
      "OIDC_CLIENT_ID",
      "OIDC_CLIENT_SECRET",
      "OIDC_REDIRECT_URI",
      "OIDC_POST_LOGOUT_REDIRECT_URI",
    ] as const) {
      if (!environment[name]) {
        context.addIssue({
          code: "custom",
          message: `${name} is required for the controlled deployment profile.`,
          path: [name],
        });
      }
    }

    for (const name of [
      "ACRONYMICON_PUBLIC_ORIGIN",
      "OIDC_ISSUER_URL",
      "OIDC_REDIRECT_URI",
      "OIDC_POST_LOGOUT_REDIRECT_URI",
    ] as const) {
      const value = environment[name];

      if (value && new URL(value).protocol !== "https:") {
        context.addIssue({
          code: "custom",
          message: `${name} must use HTTPS for the controlled deployment profile.`,
          path: [name],
        });
      }
    }

    const publicOrigin = environment.ACRONYMICON_PUBLIC_ORIGIN;

    if (publicOrigin && isUrlOrigin(publicOrigin)) {
      for (const name of [
        "OIDC_REDIRECT_URI",
        "OIDC_POST_LOGOUT_REDIRECT_URI",
      ] as const) {
        const value = environment[name];

        if (value && new URL(value).origin !== new URL(publicOrigin).origin) {
          context.addIssue({
            code: "custom",
            message: `${name} must use ACRONYMICON_PUBLIC_ORIGIN for the controlled deployment profile.`,
            path: [name],
          });
        }
      }
    }

    if (environment.SESSION_COOKIE_SECURE === "false") {
      context.addIssue({
        code: "custom",
        message:
          "SESSION_COOKIE_SECURE cannot be false for the controlled deployment profile.",
        path: ["SESSION_COOKIE_SECURE"],
      });
    }

    if (environment.OIDC_ALLOW_INSECURE_HTTP === "true") {
      context.addIssue({
        code: "custom",
        message:
          "OIDC_ALLOW_INSECURE_HTTP cannot be true for the controlled deployment profile.",
        path: ["OIDC_ALLOW_INSECURE_HTTP"],
      });
    }
  });

export type DatabaseConfig = ReturnType<typeof parseDatabaseConfig>;
export type AppConfig = ReturnType<typeof parseAppConfig>;

export function parseDatabaseConfig(environment: NodeJS.ProcessEnv) {
  const result = databaseEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throwConfigurationError("database", result.error);
  }

  return buildDatabaseConfig(result.data);
}

export function parseAppConfig(environment: NodeJS.ProcessEnv) {
  const result = applicationEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throwConfigurationError("application", result.error);
  }

  const values = result.data;
  const oidcConfigured = Boolean(
    values.OIDC_ISSUER_URL &&
      values.OIDC_CLIENT_ID &&
      values.OIDC_CLIENT_SECRET,
  );

  return {
    environment: values.NODE_ENV,
    deployment: {
      profile: values.ACRONYMICON_DEPLOYMENT_PROFILE,
      publicOrigin: values.ACRONYMICON_PUBLIC_ORIGIN,
    },
    database: buildDatabaseConfig(values),
    session: {
      secret:
        values.SESSION_SECRET ??
        /* c8 ignore next -- production absence is rejected above. */
        "dev-session-secret-change-me",
      secureCookie:
        values.SESSION_COOKIE_SECURE === undefined
          ? values.NODE_ENV === "production"
          : values.SESSION_COOKIE_SECURE === "true",
    },
    oidc: oidcConfigured
      ? {
          issuerUrl: values.OIDC_ISSUER_URL!,
          clientId: values.OIDC_CLIENT_ID!,
          clientSecret: values.OIDC_CLIENT_SECRET!,
          redirectUri: values.OIDC_REDIRECT_URI,
          postLogoutRedirectUri: values.OIDC_POST_LOGOUT_REDIRECT_URI,
          scopes: values.OIDC_SCOPES ?? "openid profile email",
          allowInsecureHttp: values.OIDC_ALLOW_INSECURE_HTTP === "true",
          claims: {
            userId: values.OIDC_CLAIM_USER_ID ?? "sub",
            username: values.OIDC_CLAIM_USERNAME,
            displayName: values.OIDC_CLAIM_DISPLAY_NAME,
            email: values.OIDC_CLAIM_EMAIL ?? "email",
            groups: values.OIDC_CLAIM_GROUPS ?? "groups",
          },
        }
      : null,
  };
}

function isUrlOrigin(value: string) {
  const url = new URL(value);

  return (
    !url.username &&
    !url.password &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash
  );
}

export function getAppConfig() {
  return parseAppConfig(process.env);
}

export function getDatabaseConfig() {
  return parseDatabaseConfig(process.env);
}

function buildDatabaseConfig(values: {
  DATABASE_PATH?: string;
  DRIZZLE_MIGRATIONS_PATH?: string;
  RUN_MIGRATIONS_ON_STARTUP?: "true" | "false";
}) {
  return {
    path: values.DATABASE_PATH ?? "./data/acronymicon.sqlite",
    migrationsFolder: values.DRIZZLE_MIGRATIONS_PATH ?? "./drizzle",
    runMigrations: values.RUN_MIGRATIONS_ON_STARTUP !== "false",
  };
}

function throwConfigurationError(scope: string, error: z.ZodError): never {
  const details = error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid ${scope} configuration:\n${details}`, {
    cause: error,
  });
}
