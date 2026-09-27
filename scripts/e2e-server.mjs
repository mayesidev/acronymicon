import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { get as httpsGet } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { startTlsProxy } from "./e2e-tls-proxy.mjs";

const port = "3100";
const authenticatedPort = "3101";
const controlledPort = "3102";
const controlledBackendPort = "3103";
const directory = mkdtempSync(join(tmpdir(), "acronymicon-e2e-"));
const databasePath = join(directory, "acronymicon.sqlite");
const controlledDatabasePath = join(directory, "controlled.sqlite");
const certificateDirectory = join(directory, "certs");
const certificatePath = join(certificateDirectory, "cert.pem");
const keyPath = join(certificateDirectory, "key.pem");
const controlledComposePath = join(process.cwd(), "tests/e2e/compose.controlled.yml");
const oidcIssuerUrl =
  "http://keycloak.localtest.me:8080/realms/acronymicon";
const controlledIssuerUrl =
  "https://keycloak.localtest.me:8443/realms/acronymicon";
const environment = {
  ...process.env,
  VITE_ACRONYMICON_VERSION: "v0.0.0-e2e",
  ACRONYMICON_DEPLOYMENT_PROFILE: "standard",
  ACRONYMICON_DICTIONARY_ACCESS: "open",
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
const controlledEnvironment = {
  ...environment,
  NODE_ENV: "production",
  HOST: "127.0.0.1",
  DATABASE_PATH: controlledDatabasePath,
  ACRONYMICON_DEPLOYMENT_PROFILE: "controlled",
  ACRONYMICON_DICTIONARY_ACCESS: "authenticated",
  ACRONYMICON_PUBLIC_ORIGIN: `https://localhost:${controlledPort}`,
  ACRONYMICON_ACCESS_NOTICE: "Authorized test access only.",
  ACRONYMICON_SENSITIVITY_LABEL: "Test controlled content",
  ACRONYMICON_READ_GROUPS: "acronymicon-admin",
  ACRONYMICON_SUBMIT_GROUPS: "acronymicon-admin",
  SESSION_SECRET: randomBytes(32).toString("hex"),
  SESSION_COOKIE_SECURE: "true",
  SESSION_ABSOLUTE_TIMEOUT_MINUTES: "480",
  SESSION_INACTIVITY_TIMEOUT_MINUTES: "480",
  SESSION_REAUTHENTICATION_INTERVAL_MINUTES: "480",
  OIDC_ISSUER_URL: controlledIssuerUrl,
  OIDC_CLIENT_ID: "acronymicon-controlled-e2e",
  OIDC_CLIENT_SECRET: "local-controlled-e2e-client-secret",
  OIDC_REDIRECT_URI: `https://localhost:${controlledPort}/auth/callback`,
  OIDC_POST_LOGOUT_REDIRECT_URI: `https://localhost:${controlledPort}/`,
  OIDC_ALLOW_INSECURE_HTTP: "false",
  NODE_EXTRA_CA_CERTS: certificatePath,
};
const composeEnvironment = {
  ...process.env,
  ACRONYMICON_E2E_CERT_DIR: certificateDirectory,
  ACRONYMICON_E2E_REALM_PATH: join(
    process.cwd(),
    "keycloak/realm-acronymicon.json",
  ),
};

const servers = [];
let tlsProxy;
let shuttingDown = false;

try {
  mkdirSync(certificateDirectory);
  execFileSync(
    "openssl",
    [
      "req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes",
      "-days", "1", "-subj", "/CN=acronymicon-e2e",
      "-addext", "subjectAltName=DNS:localhost,DNS:keycloak.localtest.me",
      "-addext", "basicConstraints=critical,CA:TRUE",
      "-keyout", keyPath, "-out", certificatePath,
    ],
    { stdio: "ignore" },
  );
  chmodSync(keyPath, 0o644);
  execFileSync("docker", ["compose", "up", "-d", "keycloak"], {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  execFileSync(
    "docker",
    ["compose", "-f", controlledComposePath, "up", "-d", "--force-recreate"],
    { cwd: process.cwd(), env: composeEnvironment, stdio: "inherit" },
  );
  await waitForHttp(
    `${oidcIssuerUrl}/.well-known/openid-configuration`,
    "Keycloak OIDC discovery",
  );
  await waitForHttps(
    `${controlledIssuerUrl}/.well-known/openid-configuration`,
    "controlled Keycloak OIDC discovery",
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
  for (const command of ["db:migrate", "db:seed"]) {
    execFileSync("pnpm", ["run", command], {
      cwd: process.cwd(),
      env: controlledEnvironment,
      stdio: "inherit",
    });
  }
  execFileSync("pnpm", ["run", "build"], {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  startServer(port);
  startServer(authenticatedPort, {
    ACRONYMICON_DICTIONARY_ACCESS: "authenticated",
    ACRONYMICON_ACCESS_NOTICE: "Authorized test access only.",
    ACRONYMICON_SENSITIVITY_LABEL: "Test controlled content",
    OIDC_REDIRECT_URI: `http://localhost:${authenticatedPort}/auth/callback`,
    OIDC_POST_LOGOUT_REDIRECT_URI: `http://localhost:${authenticatedPort}/`,
  });
  startServer(controlledBackendPort, controlledEnvironment);
  tlsProxy = await startTlsProxy({
    certificatePath,
    keyPath,
    port: controlledPort,
    upstreamPort: controlledBackendPort,
  });

  await Promise.all([
    waitForServer(port),
    waitForServer(authenticatedPort),
    waitForHttps(`https://localhost:${controlledPort}/auth/login`, "controlled E2E server"),
  ]);
  await new Promise(() => {});
} catch (error) {
  console.error(error);
  await shutdown(1);
}

function startServer(serverPort, overrides = {}) {
  const server = spawn(
    "pnpm",
    ["run", "start"],
    {
      cwd: process.cwd(),
      env: {
        ...environment,
        ...overrides,
        NODE_ENV: "production",
        HOST: overrides.HOST ?? "0.0.0.0",
        PORT: serverPort,
      },
      stdio: "inherit",
    },
  );

  server.on("exit", (code) => {
    if (!shuttingDown) {
      process.exit(code ?? 1);
    }
  });
  servers.push(server);
}

async function waitForServer(serverPort) {
  await waitForHttp(
    `http://localhost:${serverPort}/`,
    `E2E server on port ${serverPort}`,
  );
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

async function waitForHttps(url, name) {
  const deadline = Date.now() + 120_000;
  const certificate = readFileSync(certificatePath);

  while (Date.now() < deadline) {
    try {
      const response = await new Promise((resolve, reject) => {
        const request = httpsGet(url, { ca: certificate }, (result) => {
          result.resume();
          result.on("end", () => resolve(result));
        });
        request.setTimeout(5_000, () => request.destroy(new Error("HTTPS probe timed out")));
        request.on("error", reject);
      });

      if (response.statusCode === 200) {
        return;
      }
    } catch {
      // The HTTPS fixture is still starting.
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
  for (const server of servers) {
    server.kill("SIGTERM");
  }
  tlsProxy?.close();
  try {
    execFileSync(
      "docker",
      ["compose", "-f", controlledComposePath, "down", "--remove-orphans"],
      { cwd: process.cwd(), env: composeEnvironment, stdio: "ignore", timeout: 4_000 },
    );
  } catch {
    // The test-specific container may already be stopped or Docker unavailable.
  }
  rmSync(directory, { recursive: true, force: true });
  process.exit(exitCode);
}
