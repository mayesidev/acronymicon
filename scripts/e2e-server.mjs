import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = "3100";
const directory = mkdtempSync(join(tmpdir(), "acronymicon-e2e-"));
const databasePath = join(directory, "acronymicon.sqlite");
const oidcIssuerUrl =
  "http://keycloak.localtest.me:8080/realms/acronymicon";
const environment = {
  ...process.env,
  DATABASE_PATH: databasePath,
  DRIZZLE_MIGRATIONS_PATH: join(process.cwd(), "drizzle"),
  SESSION_SECRET: "e2e-session-secret",
  SESSION_COOKIE_SECURE: "false",
  OIDC_ISSUER_URL: oidcIssuerUrl,
  OIDC_CLIENT_ID: "acronymicon",
  OIDC_CLIENT_SECRET: "local-development-client-secret",
  OIDC_REDIRECT_URI: `http://localhost:${port}/auth/callback`,
  OIDC_POST_LOGOUT_REDIRECT_URI: `http://localhost:${port}/`,
  OIDC_SCOPES: "openid profile email",
  OIDC_ALLOW_INSECURE_HTTP: "true",
  OIDC_CLAIM_USER_ID: "sub",
  OIDC_CLAIM_USERNAME: "preferred_username",
  OIDC_CLAIM_DISPLAY_NAME: "name",
  OIDC_CLAIM_EMAIL: "email",
  OIDC_CLAIM_GROUPS: "groups",
};

let server;
let shuttingDown = false;

try {
  execFileSync("docker", ["compose", "up", "-d", "keycloak"], {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  await waitForHttp(
    `${oidcIssuerUrl}/.well-known/openid-configuration`,
    "Keycloak OIDC discovery",
  );
  execFileSync("pnpm", ["run", "db:migrate"], {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  execFileSync("pnpm", ["run", "db:seed"], {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  execFileSync("pnpm", ["run", "build"], {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });

  server = spawn(
    "pnpm",
    ["run", "start"],
    {
      cwd: process.cwd(),
      env: { ...environment, HOST: "0.0.0.0", PORT: port },
      stdio: "inherit",
    },
  );

  server.on("exit", (code) => {
    if (!shuttingDown) {
      process.exit(code ?? 1);
    }
  });

  await waitForServer();
  await new Promise(() => {});
} catch (error) {
  console.error(error);
  await shutdown(1);
}

async function waitForServer() {
  await waitForHttp(`http://localhost:${port}/`, "E2E server");
}

async function waitForHttp(url, name) {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // The development server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`${name} did not become ready: ${url}`);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  server?.kill("SIGTERM");
  rmSync(directory, { recursive: true, force: true });
  process.exit(exitCode);
}
