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
const prepareJob = publishWorkflow
  .split("\n  prepare:\n", 2)[1]
  ?.split("\n  build:\n", 1)[0];
const buildJob = publishWorkflow
  .split("\n  build:\n", 2)[1]
  ?.split("\n  publish:\n", 1)[0];
const publishJob = publishWorkflow.split("\n  publish:\n", 2)[1];

if (!qualityJob) {
  throw new Error("CI must define a quality job before the browser job.");
}

if (!prepareJob || !buildJob || !publishJob) {
  throw new Error("Container publishing must validate, build, and assemble.");
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
  it("checks out a validated release tag before building", () => {
    expect(prepareJob).toContain("^v[0-9]+\\.[0-9]+\\.[0-9]+$");
    expect(buildJob).toContain("needs: prepare");
    expect(buildJob).toContain("ref: refs/tags/${{ inputs.release_tag }}");
  });

  it("builds AMD64 and ARM64 natively without QEMU", () => {
    expect(buildJob).toContain("platform: linux/amd64\n            runner: ubuntu-24.04");
    expect(buildJob).toContain("platform: linux/arm64\n            runner: ubuntu-26.04-arm");
    expect(buildJob).toContain("platforms: ${{ matrix.platform }}");
    expect(publishWorkflow).not.toContain("docker/setup-qemu-action");
  });

  it("preserves per-platform provenance and SBOM in digest-based publication", () => {
    expect(buildJob).toContain("push-by-digest=true,name-canonical=true,push=true");
    expect(buildJob).toContain("provenance: mode=max");
    expect(buildJob).toContain("sbom: true");
    expect(buildJob).toContain("IMAGE_DIGEST: ${{ steps.image.outputs.digest }}");
    expect(publishWorkflow).not.toContain("actions: write");
    expect(publishWorkflow).not.toContain("attestations: write");
    expect(publishWorkflow).not.toContain("id-token: write");
  });

  it("builds the release tag into the published application metadata", () => {
    expect(buildJob).toContain(
      "ACRONYMICON_VERSION=${{ inputs.release_tag }}",
    );
  });

  it("applies existing tags only after both platforms build and verifies the manifest", () => {
    expect(publishJob).toContain("- prepare\n      - build");
    expect(publishJob).toContain("type=raw,value=${{ needs.prepare.outputs.version }}");
    expect(publishJob).toContain("type=raw,value=${{ needs.prepare.outputs.major_minor }}");
    expect(publishJob).toContain("type=raw,value=latest");
    expect(publishJob).toContain('"${#digests[@]}" -eq 2');
    expect(publishJob).toContain('docker buildx imagetools create "${args[@]}"');
    expect(publishJob).toContain('sort == ["amd64", "arm64"]');
    expect(publishJob).toContain("--format '{{json .Provenance}}'");
    expect(publishJob).toContain("--format '{{json .SBOM}}'");
  });
});

describe("CI build metadata policy", () => {
  it("passes the pull request or merged change title to scope classification", () => {
    expect(ciWorkflow).toContain(
      "CHANGE_TITLE: ${{ github.event.pull_request.title || github.event.head_commit.message }}",
    );
  });

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

describe("Renovate configuration validation", () => {
  it("runs the validator in the required quality job when Renovate config changes", () => {
    expect(ciWorkflow).toContain(
      "renovate_config: ${{ steps.scope.outputs.renovate_config }}",
    );
    expect(qualityJob).toContain(
      "if: needs.scope.outputs.renovate_config == 'true'",
    );
    expect(qualityJob).toContain(
      "pnpm --package=renovate@44.39.0 dlx renovate-config-validator",
    );
  });
});
