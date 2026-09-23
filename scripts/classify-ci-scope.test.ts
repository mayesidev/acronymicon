import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("CI scope classification", () => {
  it.each([
    ["documentation tree", ["docs/architecture/modules.md", "docs/flow.svg"]],
    [
      "public Markdown and license",
      [
        "README.md",
        "CONTRIBUTING.md",
        "SECURITY.md",
        ".github/ISSUE_TEMPLATE/bug_report.md",
        ".github/pull_request_template.md",
        "LICENSE",
      ],
    ],
  ])("skips executable checks for %s", (_, files) => {
    expect(classify(files)).toEqual({
      application: false,
      browser: false,
      container: false,
      multi_arch: false,
      renovate_config: false,
    });
  });

  it.each([
    ["application source", ["app/root.tsx"]],
    ["shared UI source", ["app/ui/components/button.tsx"]],
    ["dependency metadata", ["package.json", "pnpm-lock.yaml"]],
    ["executable scripts", ["scripts/import-acronyms.ts"]],
    ["mixed documentation and source", ["README.md", "app/root.tsx"]],
  ])("selects full validation for %s", (_, files) => {
    expect(classify(files)).toEqual({
      application: true,
      browser: true,
      container: true,
      multi_arch: false,
      renovate_config: false,
    });
  });

  it.each([
    ".github/workflows/ci.yml",
    "scripts/classify-ci-scope.mjs",
  ])("runs every suite when %s changes", (file) => {
    expect(classify([file])).toEqual({
      application: true,
      browser: true,
      container: true,
      multi_arch: true,
      renovate_config: false,
    });
  });

  it.each([
    ["Dockerfile", ["Dockerfile"]],
    ["Docker ignore rules", [".dockerignore"]],
  ])("selects container validation for %s", (_, files) => {
    expect(classify(files)).toEqual({
      application: false,
      browser: false,
      container: true,
      multi_arch: true,
      renovate_config: false,
    });
  });

  it("combines application and multi-architecture requirements", () => {
    expect(classify(["app/root.tsx", "Dockerfile"])).toEqual({
      application: true,
      browser: true,
      container: true,
      multi_arch: true,
      renovate_config: false,
    });
  });

  it.each([
    "chore(deps-runtime): update better-sqlite3",
    "build(runtime): update the runtime image",
  ])("adds multi-architecture validation for %s", (changeTitle) => {
    expect(classify(["package.json", "pnpm-lock.yaml"], changeTitle)).toEqual({
      application: true,
      browser: true,
      container: true,
      multi_arch: true,
      renovate_config: false,
    });
  });

  it("checks release workflow policy and both native container builds", () => {
    expect(classify([".github/workflows/publish-container.yml"])).toEqual({
      application: true,
      browser: false,
      container: true,
      multi_arch: true,
      renovate_config: false,
    });
  });

  it("keeps development dependency validation on the primary architecture", () => {
    expect(
      classify(
        ["package.json", "pnpm-lock.yaml"],
        "chore(deps): update semantic-release",
      ),
    ).toEqual({
      application: true,
      browser: true,
      container: true,
      multi_arch: false,
      renovate_config: false,
    });
  });

  it("validates Renovate configuration without selecting application suites", () => {
    expect(classify(["renovate.json"])).toEqual({
      application: false,
      browser: false,
      container: false,
      multi_arch: false,
      renovate_config: true,
    });

    expect(classify(["renovate.json", "app/root.tsx"])).toEqual({
      application: true,
      browser: true,
      container: true,
      multi_arch: false,
      renovate_config: true,
    });
  });
});

function classify(files: string[], changeTitle = "") {
  const result = spawnSync(
    process.execPath,
    [join(process.cwd(), "scripts/classify-ci-scope.mjs")],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, CHANGE_TITLE: changeTitle },
      input: files.join("\n"),
    },
  );

  expect(result.status, result.stderr).toBe(0);

  return Object.fromEntries(
    result.stdout
      .trim()
      .split("\n")
      .map((line) => {
        const [name, enabled] = line.split("=");
        return [name, enabled === "true"];
      }),
  );
}
