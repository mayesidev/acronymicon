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

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_PATH: optionalString,
    DRIZZLE_MIGRATIONS_PATH: optionalString,
    RUN_MIGRATIONS_ON_STARTUP: optionalBoolean,
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

    if (oidcValues.length === 0) {
      return;
    }

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
  });

export type AppConfig = ReturnType<typeof parseAppConfig>;

export function parseAppConfig(environment: NodeJS.ProcessEnv) {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid application configuration:\n${details}`, {
      cause: result.error,
    });
  }

  const values = result.data;
  const oidcConfigured = Boolean(
    values.OIDC_ISSUER_URL &&
      values.OIDC_CLIENT_ID &&
      values.OIDC_CLIENT_SECRET,
  );

  return {
    environment: values.NODE_ENV,
    database: {
      path: values.DATABASE_PATH ?? "./data/acronymicon.sqlite",
      migrationsFolder: values.DRIZZLE_MIGRATIONS_PATH ?? "./drizzle",
      runMigrations: values.RUN_MIGRATIONS_ON_STARTUP !== "false",
    },
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

export function getAppConfig() {
  return parseAppConfig(process.env);
}
