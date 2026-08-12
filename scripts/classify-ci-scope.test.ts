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
    });
  });

  it.each([
    ["application source", ["app/root.tsx"]],
    ["shared UI source", ["app/ui/components/button.tsx"]],
    ["dependency metadata", ["package.json", "pnpm-lock.yaml"]],
    ["executable scripts", ["scripts/import-acronyms.ts"]],
    ["workflow configuration", [".github/workflows/ci.yml"]],
    ["mixed documentation and source", ["README.md", "app/root.tsx"]],
  ])("selects full validation for %s", (_, files) => {
    expect(classify(files)).toEqual({
      application: true,
      browser: true,
      container: true,
      multi_arch: false,
    });
  });

  it.each([
    ["Dockerfile", ["Dockerfile"]],
    ["Docker ignore rules", [".dockerignore"]],
    [
      "container publishing workflow",
      [".github/workflows/publish-container.yml"],
    ],
  ])("selects container validation for %s", (_, files) => {
    expect(classify(files)).toEqual({
      application: false,
      browser: false,
      container: true,
      multi_arch: true,
    });
  });

  it("combines application and multi-architecture requirements", () => {
    expect(classify(["app/root.tsx", "Dockerfile"])).toEqual({
      application: true,
      browser: true,
      container: true,
      multi_arch: true,
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
