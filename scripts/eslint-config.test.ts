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
  it.each([
    "app/components/header-actions.test.tsx",
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
