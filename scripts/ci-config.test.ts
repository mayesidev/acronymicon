import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const publishWorkflow = readFileSync(
  ".github/workflows/publish-container.yml",
  "utf8",
);
const qualityJob = ciWorkflow
  .split("\n  quality:\n", 2)[1]
  ?.split("\n  browser:\n", 1)[0];
const publishJob = publishWorkflow.split("\n  publish:\n", 2)[1];
const qemuStep = publishJob
  ?.split("\n      - name: Set up QEMU\n", 2)[1]
  ?.split("\n      - name:", 1)[0];

if (!qualityJob) {
  throw new Error("CI must define a quality job before the browser job.");
}

if (!publishJob || !qemuStep) {
  throw new Error("Container publishing must define a QEMU setup step.");
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

describe("release container-publish policy", () => {
  it("disables the QEMU image cache without granting cache-write access", () => {
    expect(qemuStep).toContain("cache-image: false");
    expect(publishWorkflow).not.toContain("actions: write");
  });

  it("retains multi-architecture publication and supply-chain metadata", () => {
    expect(publishJob).toContain("platforms: linux/amd64,linux/arm64");
    expect(publishJob).toContain("provenance: mode=max");
    expect(publishJob).toContain("sbom: true");
  });

  it("builds the release tag into the published application metadata", () => {
    expect(publishJob).toContain(
      "ACRONYMICON_VERSION=${{ inputs.release_tag }}",
    );
  });
});

describe("CI build metadata policy", () => {
  it("exercises a known version in container builds and smoke tests", () => {
    expect(
      ciWorkflow.match(
        /ACRONYMICON_VERSION=\$\{\{ env\.ACRONYMICON_TEST_VERSION \}\}/g,
      ),
    ).toHaveLength(2);
    expect(
      ciWorkflow.match(
        /EXPECTED_ACRONYMICON_VERSION: \$\{\{ env\.ACRONYMICON_TEST_VERSION \}\}/g,
      ),
    ).toHaveLength(2);
  });
});
