import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });
const invalidUiAssertion = `
import { render } from "@testing-library/react";
import { expect } from "vitest";

const { container } = render(<div />);
expect(container.firstChild).not.toBeNull();
`;
const invalidDomAssertion = `
import { expect } from "vitest";

const container = document.createElement("div");
expect(container.firstChild).not.toBeNull();
`;

describe("UI test lint configuration", () => {
  it(
    "initializes the TypeScript UI configuration within the cold-start budget",
    async () => {
      const [result] = await eslint.lintText("export {};", {
        filePath:
          "app/features/authentication/components/header-actions.test.tsx",
      });

      expect(result.fatalErrorCount).toBe(0);
    },
    30_000,
  );

  it.each([
    "app/features/authentication/components/header-actions.test.tsx",
    "app/features/submission/components/submission-form.test.tsx",
    "app/features/submission/use-duplicate-preview.test.tsx",
  ])(
    "rejects DOM implementation assertions in %s",
    async (filePath) => {
      const [result] = await eslint.lintText(invalidUiAssertion, { filePath });
      const ruleIds = result.messages.map((message) => message.ruleId);

      expect(ruleIds).toEqual(
        expect.arrayContaining([
          "jest-dom/prefer-empty",
          "testing-library/no-node-access",
        ]),
      );
    },
    15_000,
  );

  it.each([
    "app/features/submission/policy.test.ts",
    "app/features/submission/server/workflow.test.ts",
  ])(
    "does not apply DOM-specific rules to %s",
    async (filePath) => {
      const [result] = await eslint.lintText(invalidDomAssertion, { filePath });
      const ruleIds = result.messages.map((message) => message.ruleId);

      expect(ruleIds).not.toContain("jest-dom/prefer-empty");
      expect(ruleIds).not.toContain("testing-library/no-node-access");
    },
    15_000,
  );
});

describe("platform configuration boundary", () => {
  it.each([
    {
      filePath: "app/platform/config/runtime.server.ts",
      source: 'import "../../config.server";',
    },
    {
      filePath: "app/routes/home.tsx",
      source: 'import "../config.server";',
    },
    {
      filePath: "app/features/authentication/server/oidc.ts",
      source: 'import "../../../config.server";',
    },
    {
      filePath: "scripts/import-acronyms.ts",
      source: 'import "../app/config.server";',
    },
  ])(
    "rejects the legacy configuration path from $filePath",
    async ({ filePath, source }) => {
      const [result] = await eslint.lintText(source, { filePath });

      expect(result.messages.map((message) => message.ruleId)).toContain(
        "no-restricted-imports",
      );
    },
    15_000,
  );
});

describe("platform database boundary", () => {
  it.each([
    {
      filePath: "app/entry.server.tsx",
      source: 'import "./bootstrap.server";',
    },
    {
      filePath: "app/db/acronyms.server.ts",
      source:
        'import "./client.server";\nimport "./schema";\nimport "./write.server";',
    },
    {
      filePath: "scripts/migrate-database.ts",
      source: 'import "../app/db/client.server";',
    },
    {
      filePath: "test/helpers/database.ts",
      source: 'import "../../app/db/client.server";',
    },
    {
      filePath: "drizzle.config.ts",
      source: 'import "./app/db/schema";',
    },
  ])(
    "rejects retired database ownership paths from $filePath",
    async ({ filePath, source }) => {
      const [result] = await eslint.lintText(source, { filePath });

      expect(result.messages.map((message) => message.ruleId)).toContain(
        "no-restricted-imports",
      );
    },
    15_000,
  );
});
