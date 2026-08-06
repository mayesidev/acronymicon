import releaseConfig from "../.releaserc.json";
import { analyzeCommits } from "@semantic-release/commit-analyzer";
import { describe, expect, it, vi } from "vitest";

type AnalyzerOptions = Parameters<typeof analyzeCommits>[0];

const analyzerPlugin = releaseConfig.plugins.find(Array.isArray);

if (!analyzerPlugin) {
  throw new Error("Semantic release must configure the commit analyzer.");
}

const analyzerOptions = analyzerPlugin[1] as AnalyzerOptions;

describe("semantic release policy", () => {
  it.each([
    ["refactor(database): reorganize persistence", "patch"],
    ["build(runtime): change the shipped image", "patch"],
    ["chore(deps-runtime): update the SQLite driver", "patch"],
    ["fix: correct a user-facing defect", "patch"],
    ["feat: add a user-facing capability", "minor"],
    [
      "feat: replace an API\n\nBREAKING CHANGE: the old API was removed",
      "major",
    ],
  ])("analyzes %j as a %s release", async (message, releaseType) => {
    await expect(analyze(message)).resolves.toBe(releaseType);
  });

  it.each([
    "test: cover a workflow",
    "ci: reorganize validation",
    "docs: clarify deployment",
    "chore: organize repository metadata",
    "chore(deps): update development tooling",
    "build: optimize local tooling",
    "refactor(no-release): reorganize test support",
  ])("does not release for %j", async (message) => {
    await expect(analyze(message)).resolves.toBeNull();
  });
});

function analyze(message: string) {
  return analyzeCommits(analyzerOptions, {
    commits: [{ hash: "test-commit", message }],
    cwd: process.cwd(),
    logger: { log: vi.fn() },
  });
}
