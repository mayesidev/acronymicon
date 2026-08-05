import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

describe("container vulnerability policy", () => {
  const directories: string[] = [];
  const reportPath = join(
    process.cwd(),
    "test/fixtures/container-scan-report.json",
  );

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails for an unapproved high finding", () => {
    const exceptionsPath = writeExceptions([]);

    expect(() => runPolicy(reportPath, exceptionsPath)).toThrow(
      /Command failed/,
    );
  });

  it("accepts a current exact exception", () => {
    const exceptionsPath = writeExceptions([
      buildException({ expiresOn: "2026-08-06" }),
    ]);

    expect(runPolicy(reportPath, exceptionsPath)).toContain(
      "1 high/critical findings, 1 covered by current exceptions",
    );
  });

  it("fails closed when an exception expires", () => {
    const exceptionsPath = writeExceptions([
      buildException({ expiresOn: "2026-08-04" }),
    ]);

    expect(() => runPolicy(reportPath, exceptionsPath)).toThrow(
      /Command failed/,
    );
  });

  function writeExceptions(exceptions: unknown[]) {
    const directory = mkdtempSync(join(tmpdir(), "acronymicon-scan-policy-"));
    directories.push(directory);
    const path = join(directory, "exceptions.json");
    writeFileSync(path, JSON.stringify({ version: 1, exceptions }));
    return path;
  }
});

function runPolicy(reportPath: string, exceptionsPath: string) {
  return execFileSync(
    "node",
    ["scripts/check-container-scan.mjs", reportPath, exceptionsPath],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, CONTAINER_SCAN_DATE: "2026-08-05" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

function buildException({ expiresOn }: { expiresOn: string }) {
  return {
    vulnerability: "CVE-2099-0001",
    package: "example-package",
    version: "1.0.0",
    expiresOn,
    reason: "Controlled policy test fixture.",
    trackingIssue: "ACR-35",
  };
}
