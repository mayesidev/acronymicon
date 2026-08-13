import { execFileSync, spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const image = process.env.CONTAINER_IMAGE ?? "acronymicon:ci";
const expectedVersion =
  process.env.EXPECTED_ACRONYMICON_VERSION ?? "development";
const containerName = `acronymicon-smoke-${process.pid}`;
const volumeName = `acronymicon-smoke-data-${process.pid}`;
const runtimeNode = "/nodejs/bin/node";

try {
  startContainer();
  await waitForApplication();
  verifyAboutPage();
  verifyRuntimeHardening();
  verifyStandaloneContainerImporter();
  verifyFreshContainerImporter();

  removeContainer();
  startContainer();
  await waitForApplication();
  verifyPersistedContainerImporter();

  console.log(`Container smoke test passed for ${image}.`);
} catch (error) {
  const logs = getContainerLogs();
  if (logs) {
    console.error(logs);
  }
  throw error;
} finally {
  removeContainer();

  try {
    execFileSync("docker", ["volume", "rm", volumeName], { stdio: "ignore" });
  } catch {
    // The volume may not exist if Docker failed before starting the container.
  }
}

function startContainer() {
  execFileSync(
    "docker",
    [
      "run",
      "--detach",
      "--name",
      containerName,
      "--env",
      "DATABASE_PATH=/data/acronymicon.sqlite",
      "--env",
      "SESSION_SECRET=container-smoke-session-secret",
      "--volume",
      `${volumeName}:/data`,
      image,
    ],
    { stdio: "pipe" },
  );
}

function removeContainer() {
  try {
    execFileSync("docker", ["rm", "--force", containerName], {
      stdio: "ignore",
    });
  } catch {
    // The container may have failed before Docker created it.
  }
}

function verifyRuntimeHardening() {
  const script = `
    import { lstatSync } from "node:fs";

    const forbiddenPaths = [
      "/bin/sh",
      "/bin/bash",
      "/opt/yarn-v1.22.22",
      "/usr/local/bin/corepack",
      "/usr/local/bin/npm",
      "/usr/local/bin/npx",
      "/usr/local/bin/yarn",
      "/usr/local/bin/yarnpkg",
      "/usr/local/lib/node_modules/corepack",
      "/usr/local/lib/node_modules/npm",
    ];

    for (const path of forbiddenPaths) {
      try {
        lstatSync(path);
        console.error(\`Unexpected runtime path: \${path}\`);
        process.exit(1);
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    }

    if (process.getuid?.() !== 65532 || process.getgid?.() !== 65532) {
      console.error(\`Unexpected runtime identity: \${process.getuid?.()}:\${process.getgid?.()}\`);
      process.exit(1);
    }
  `;

  execFileSync(
    "docker",
    [
      "exec",
      containerName,
      runtimeNode,
      "--input-type=module",
      "--eval",
      script,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
}

function verifyAboutPage() {
  const expectedVersionLiteral = JSON.stringify(expectedVersion);
  const script = `
    const response = await fetch("http://127.0.0.1:3000/about");
    const html = await response.text();
    const expectedVersion = ${expectedVersionLiteral};

    if (!response.ok || !html.includes(expectedVersion)) {
      console.error("About page did not identify build " + expectedVersion + ".");
      process.exit(1);
    }
  `;

  execFileSync(
    "docker",
    [
      "exec",
      containerName,
      runtimeNode,
      "--input-type=module",
      "--eval",
      script,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
}

function verifyFreshContainerImporter() {
  const firstImport = runContainerImporter();
  const secondImport = runContainerImporter();

  if (
    !firstImport.stderr.includes("9 inserted, 0 duplicates skipped, 0 failed")
  ) {
    throw new Error(
      `Container importer did not insert the seed data: ${firstImport.stderr}`,
    );
  }

  if (
    !secondImport.stderr.includes("0 inserted, 9 duplicates skipped, 0 failed")
  ) {
    throw new Error(
      `Container importer is not idempotent: ${secondImport.stderr}`,
    );
  }
}

function verifyStandaloneContainerImporter() {
  const importResult = runCapturedDocker([
    "run",
    "--rm",
    "--entrypoint",
    runtimeNode,
    "--env",
    "DATABASE_PATH=/data/standalone.sqlite",
    "--volume",
    `${volumeName}:/data`,
    image,
    "build/scripts/import-acronyms.mjs",
    "seeds/acronyms.seed.json",
  ]);

  if (
    !importResult.stderr.includes("9 inserted, 0 duplicates skipped, 0 failed")
  ) {
    throw new Error(
      `Standalone container importer required unrelated application configuration: ${importResult.stderr}`,
    );
  }
}

function verifyPersistedContainerImporter() {
  const importResult = runContainerImporter();

  if (
    !importResult.stderr.includes("0 inserted, 9 duplicates skipped, 0 failed")
  ) {
    throw new Error(
      `Container importer did not preserve named-volume data: ${importResult.stderr}`,
    );
  }
}

function runContainerImporter() {
  return runCapturedDocker([
    "exec",
    containerName,
    runtimeNode,
    "build/scripts/import-acronyms.mjs",
    "seeds/acronyms.seed.json",
  ]);
}

function runCapturedDocker(arguments_) {
  const result = spawnSync("docker", arguments_, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(
      `Container importer exited with status ${result.status}: ${result.stderr}`,
      { cause: result.error },
    );
  }

  verifyImportAudit(result.stdout);
  return { stdout: result.stdout, stderr: result.stderr };
}

function verifyImportAudit(output) {
  const lines = output.trim().split("\n");
  let record;

  try {
    record = lines.length === 1 ? JSON.parse(lines[0]) : null;
  } catch {
    record = null;
  }

  if (
    record?.schemaVersion !== 1 ||
    record?.action !== "acronym.import" ||
    record?.outcome !== "succeeded"
  ) {
    throw new Error(
      `Container importer did not emit one audit record: ${output}`,
    );
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
          runtimeNode,
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
