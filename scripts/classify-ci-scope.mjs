import { readFileSync } from "node:fs";

const changedFiles = readFileSync(0, "utf8").split(/\r?\n/).filter(Boolean);
const scope = {
  application: false,
  browser: false,
  container: false,
  multi_arch: false,
};

for (const file of changedFiles) {
  if (isDocumentation(file)) {
    continue;
  }

  if (isContainerOnly(file)) {
    scope.container = true;
    scope.multi_arch = true;
    continue;
  }

  scope.application = true;
  scope.browser = true;
  scope.container = true;
}

for (const [name, enabled] of Object.entries(scope)) {
  process.stdout.write(`${name}=${enabled}\n`);
}

function isDocumentation(file) {
  return file === "LICENSE" || file.startsWith("docs/") || file.endsWith(".md");
}

function isContainerOnly(file) {
  return [
    ".dockerignore",
    ".github/workflows/publish-container.yml",
    "Dockerfile",
  ].includes(file);
}
