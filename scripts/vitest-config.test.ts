import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import vitestConfig from "../vitest.config";

describe("presentation coverage configuration", () => {
  it("applies the presentation policy to shared UI source", () => {
    expect(vitestConfig).toMatchObject({
      test: {
        coverage: {
          thresholds: {
            "app/ui/**": {
              statements: 80,
              branches: 55,
              functions: 75,
              lines: 80,
            },
          },
        },
      },
    });
  });
});

it.each([
  {
    source: "app/features/submission/components/submission-form.tsx",
    threshold: '"app/features/**/components/**" threshold (80%)',
  },
  {
    source: "app/features/submission/use-duplicate-preview.ts",
    threshold: '"app/features/**/{hooks/**,use-*.{ts,tsx}}" threshold (80%)',
  },
  {
    source: "app/platform/database/acronym-repository.server.ts",
    threshold:
      '"app/platform/database/{acronym-repository.server,client.server,import.server,schema,write.server}.ts" threshold (90%)',
  },
])(
  "rejects $source below its configured threshold",
  ({ source, threshold }) => {
    const coverageDirectory = mkdtempSync(
      join(tmpdir(), "acronymicon-coverage-policy-"),
    );

    try {
      const result = spawnSync(
        process.execPath,
        [
          join(process.cwd(), "node_modules/vitest/vitest.mjs"),
          "run",
          "app/features/submission/policy.test.ts",
          "--coverage",
          `--coverage.include=${source}`,
          `--coverage.reportsDirectory=${coverageDirectory}`,
          "--coverage.reporter=text",
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: { ...process.env, FORCE_COLOR: "0" },
        },
      );
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain(threshold);
    } finally {
      rmSync(coverageDirectory, { recursive: true, force: true });
    }
  },
);
