import { execFileSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const image = process.env.CONTAINER_IMAGE ?? "acronymicon:ci";
const containerName = `acronymicon-smoke-${process.pid}`;

try {
  execFileSync(
    "docker",
    [
      "run",
      "--detach",
      "--name",
      containerName,
      "--env",
      "COREPACK_ENABLE_NETWORK=0",
      "--env",
      "DATABASE_PATH=/tmp/acronymicon.sqlite",
      "--env",
      "SESSION_SECRET=container-smoke-session-secret",
      image,
    ],
    { stdio: "pipe" },
  );

  await waitForApplication();
  verifyRuntimeToolingRemoved();
  verifyContainerImporter();
  console.log(`Container smoke test passed for ${image}.`);
} catch (error) {
  const logs = getContainerLogs();
  if (logs) {
    console.error(logs);
  }
  throw error;
} finally {
  try {
    execFileSync("docker", ["rm", "--force", containerName], {
      stdio: "ignore",
    });
  } catch {
    // The container may have failed before Docker created it.
  }
}

function verifyRuntimeToolingRemoved() {
  const script = `
    for command in npm npx corepack yarn yarnpkg; do
      if command -v "$command" >/dev/null 2>&1; then
        echo "Unexpected runtime command: $command" >&2
        exit 1
      fi
    done

    for path in \
      /opt/yarn-v1.22.22 \
      /usr/local/lib/node_modules/corepack \
      /usr/local/lib/node_modules/npm; do
      if test -e "$path" || test -L "$path"; then
        echo "Unexpected runtime package tree: $path" >&2
        exit 1
      fi
    done
  `;

  execFileSync("docker", ["exec", containerName, "sh", "-c", script], {
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function verifyContainerImporter() {
  const importerArguments = [
    "exec",
    containerName,
    "node",
    "build/scripts/import-acronyms.mjs",
    "seeds/acronyms.seed.json",
  ];
  const firstImport = execFileSync("docker", importerArguments, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const secondImport = execFileSync("docker", importerArguments, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!firstImport.includes("9 inserted, 0 duplicates skipped, 0 failed")) {
    throw new Error(`Container importer did not insert the seed data: ${firstImport}`);
  }

  if (!secondImport.includes("0 inserted, 9 duplicates skipped, 0 failed")) {
    throw new Error(`Container importer is not idempotent: ${secondImport}`);
  }
}

async function waitForApplication() {
  const requestScript = `
    const response = await fetch("http://127.0.0.1:3000/");
    const html = await response.text();
    if (!response.ok || !html.includes("<title>Acronymicon</title>")) {
      process.exit(1);
    }
  `;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      execFileSync(
        "docker",
        [
          "exec",
          containerName,
          "node",
          "--input-type=module",
          "--eval",
          requestScript,
        ],
        { stdio: "pipe" },
      );
      return;
    } catch {
      await setTimeout(250);
    }
  }

  throw new Error(`Container did not become ready: ${containerName}`);
}

function getContainerLogs() {
  try {
    return execFileSync("docker", ["logs", containerName], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}
