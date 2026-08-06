import eslint from "@eslint/js";
import globals from "globals";
import jestDom from "eslint-plugin-jest-dom";
import jsxA11y from "eslint-plugin-jsx-a11y";
import playwright from "eslint-plugin-playwright";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import testingLibrary from "eslint-plugin-testing-library";
import tseslint from "typescript-eslint";

const uiTestFiles = [
  "app/components/**/*.test.{ts,tsx}",
  "app/features/**/components/**/*.test.{ts,tsx}",
  "app/features/**/hooks/**/*.test.{ts,tsx}",
  "app/features/**/use-*.test.{ts,tsx}",
];

export default tseslint.config(
  {
    ignores: [
      "build/**",
      "coverage/**",
      "data/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      ".react-router/**",
    ],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    ...react.configs.flat.recommended,
    rules: {
      ...react.configs.flat.recommended.rules,
      "react/prop-types": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    ...react.configs.flat["jsx-runtime"],
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-undef": "off",
    },
  },
  {
    files: [
      "app/components/**/*.{ts,tsx}",
      "app/domain/**/*.{ts,tsx}",
      "app/features/**/*.{ts,tsx}",
      "app/ui/**/*.{ts,tsx}",
    ],
    ignores: [
      "app/features/**/*.server.{ts,tsx}",
      "app/features/**/server/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/*.server",
                "**/*.server.*",
                "~/platform/**",
                "../platform/**",
                "../../platform/**",
                "../../../platform/**",
                "~/routes/**",
                "../routes/**",
                "../../routes/**",
                "../../../routes/**",
                "~/db/**",
                "../db/**",
                "../../db/**",
                "../../../db/**",
                "~/auth/**",
                "../auth/**",
                "../../auth/**",
                "../../../auth/**",
                "**/config.server",
                "~/bootstrap.server",
                "../bootstrap.server",
                "../../bootstrap.server",
              ],
              message:
                "Client-capable UI and contracts must not depend on server or platform implementations.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/platform/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "~/routes/**",
                "../../routes/**",
                "~/ui/**",
                "../../ui/**",
                "~/components/**",
                "../../components/**",
              ],
              message:
                "Platform implementations cannot depend on route or presentation modules.",
            },
            {
              group: ["**/config.server"],
              message:
                "Runtime configuration is owned by app/platform/config.",
            },
            {
              group: [
                "**/bootstrap.server",
                "**/db/acronyms.server",
                "**/db/client.server",
                "**/db/schema",
                "**/db/write.server",
              ],
              message:
                "Database implementations are owned by app/platform/database.",
            },
          ],
        },
      ],
    },
  },
  {
    // Completed route boundaries cannot drift back toward platform or legacy
    // implementation imports.
    files: ["app/routes/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "~/platform/**",
                "../platform/**",
                "~/db/**",
                "../db/**",
                "~/auth/**",
                "../auth/**",
                "**/config.server",
                "**/bootstrap.server",
                "**/db/client.server",
                "**/db/schema",
                "**/db/write.server",
              ],
              message:
                "Route adapters compose feature APIs instead of importing platform or legacy implementation paths.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "app/*.{ts,tsx}",
      "app/db/**/*.{ts,tsx}",
      "app/features/**/*.server.{ts,tsx}",
      "app/features/**/server/**/*.{ts,tsx}",
      "scripts/**/*.{ts,tsx}",
      "test/**/*.{ts,tsx}",
      "drizzle.config.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/config.server"],
              message:
                "Runtime configuration is owned by app/platform/config.",
            },
            {
              group: [
                "**/bootstrap.server",
                "./acronyms.server",
                "**/db/acronyms.server",
                "./client.server",
                "./schema",
                "./write.server",
                "**/db/client.server",
                "**/db/schema",
                "**/db/write.server",
              ],
              message:
                "Database implementations are owned by app/platform/database.",
            },
          ],
        },
      ],
    },
  },
  {
    files: uiTestFiles,
    ...testingLibrary.configs["flat/react"],
  },
  {
    files: uiTestFiles,
    ...jestDom.configs["flat/recommended"],
  },
  {
    files: ["tests/e2e/**/*.{ts,tsx}"],
    ...playwright.configs["flat/recommended"],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
);
