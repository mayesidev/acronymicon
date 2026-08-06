import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const qualityJob = workflow
  .split("\n  quality:\n", 2)[1]
  ?.split("\n  browser:\n", 1)[0];

if (!qualityJob) {
  throw new Error("CI must define a quality job before the browser job.");
}

describe("CI container-build policy", () => {
  it("bounds both the quality job and GitHub Actions cache operations", () => {
    expect(qualityJob).toContain("timeout-minutes: 10");
    expect(qualityJob).toContain(
      "cache-from: type=gha,scope=ci,timeout=3m",
    );
    expect(qualityJob).toContain(
      "cache-to: type=gha,mode=min,scope=ci,timeout=2m,ignore-error=true",
    );
  });

  it.each([
    "- name: Smoke test container",
    "- name: Scan final runtime image",
    "- name: Enforce container vulnerability policy",
  ])("retains the post-build check %s", (step) => {
    expect(qualityJob.indexOf(step)).toBeGreaterThan(
      qualityJob.indexOf("- name: Build container"),
    );
  });
});
