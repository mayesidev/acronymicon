import releaseConfig from "../.releaserc.json";
import { analyzeCommits } from "@semantic-release/commit-analyzer";
import { generateNotes } from "@semantic-release/release-notes-generator";
import { describe, expect, it, vi } from "vitest";

type AnalyzerOptions = Parameters<typeof analyzeCommits>[0];
type ReleaseNotesOptions = Parameters<typeof generateNotes>[0];

const analyzerPlugin = releaseConfig.plugins.find(
  (plugin) =>
    Array.isArray(plugin) &&
    typeof plugin[0] === "string" &&
    plugin[0].endsWith("commit-analyzer"),
);
const releaseNotesPlugin = releaseConfig.plugins.find(
  (plugin) =>
    Array.isArray(plugin) &&
    typeof plugin[0] === "string" &&
    plugin[0].endsWith("release-notes-generator"),
);

if (!analyzerPlugin) {
  throw new Error("Semantic release must configure the commit analyzer.");
}

if (!releaseNotesPlugin) {
  throw new Error("Semantic release must configure release notes.");
}

const analyzerOptions = analyzerPlugin[1] as AnalyzerOptions;
const releaseNotesOptions = releaseNotesPlugin[1] as ReleaseNotesOptions;

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

  it("documents every runtime maintenance category that triggers a patch", async () => {
    const notes = await generate([
      ["refactor(database): reorganize persistence", "refactor-hash"],
      ["build(runtime): change the shipped image", "build-hash"],
      [
        "chore(deps-runtime): update the SQLite driver",
        "dependency-hash",
      ],
    ]);

    expect(notes).toContain("### Code Refactoring");
    expect(notes).toContain("reorganize persistence");
    expect(notes).toContain("### Build System");
    expect(notes).toContain("change the shipped image");
    expect(notes).toContain("### Runtime Dependencies");
    expect(notes).toContain("update the SQLite driver");
  });

  it("omits categories and scopes that do not trigger a release", async () => {
    const notes = await generate([
      ["test: cover a workflow", "test-hash"],
      ["ci: reorganize validation", "ci-hash"],
      ["docs: clarify deployment", "docs-hash"],
      ["chore: organize repository metadata", "chore-hash"],
      ["chore(deps): update development tooling", "dev-dependency-hash"],
      ["build: optimize local tooling", "build-hash"],
      [
        "refactor(no-release): reorganize test support",
        "no-release-hash",
      ],
    ]);

    expect(notes).not.toMatch(
      /cover a workflow|reorganize validation|clarify deployment|organize repository metadata|update development tooling|optimize local tooling|reorganize test support/,
    );
  });
});

function analyze(message: string) {
  return analyzeCommits(analyzerOptions, {
    commits: [{ hash: "test-commit", message }],
    cwd: process.cwd(),
    logger: { log: vi.fn() },
  });
}

function generate(commits: Array<[message: string, hash: string]>) {
  return generateNotes(releaseNotesOptions, {
    commits: commits.map(([message, hash]) => ({ message, hash })),
    cwd: process.cwd(),
    lastRelease: { gitHead: "previous-hash", gitTag: "v1.0.0" },
    nextRelease: {
      gitHead: "next-hash",
      gitTag: "v1.0.1",
      version: "1.0.1",
    },
    options: {
      repositoryUrl: "https://github.com/mayesidev/acronymicon.git",
    },
  });
}
