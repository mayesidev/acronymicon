import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const workflowDirectory = join(process.cwd(), ".github", "workflows");
const releases = new Set();
const labels = [];

for (const file of readdirSync(workflowDirectory)) {
  if (!/\.ya?ml$/.test(file)) continue;

  const source = readFileSync(join(workflowDirectory, file), "utf8");
  const runners = source.matchAll(
    /^\s*(?:runs-on|runner):\s*(ubuntu-(?:latest|\d+\.\d+)(?:-arm)?)\s*$/gm,
  );

  for (const [, label] of runners) {
    labels.push(label);
    releases.add(label.replace(/^ubuntu-|-arm$/g, ""));
  }
}

if (
  releases.size !== 1 ||
  releases.has("latest") ||
  !labels.some((label) => label.endsWith("-arm")) ||
  !labels.some((label) => !label.endsWith("-arm"))
) {
  console.error(`Ubuntu workflow runners must share one pinned release: ${labels.join(", ")}`);
  process.exitCode = 1;
}
