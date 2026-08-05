import eslint from "@eslint/js";
import globals from "globals";
import jestDom from "eslint-plugin-jest-dom";
import jsxA11y from "eslint-plugin-jsx-a11y";
import playwright from "eslint-plugin-playwright";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import testingLibrary from "eslint-plugin-testing-library";
import tseslint from "typescript-eslint";

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
                "~/config.server",
                "../config.server",
                "../../config.server",
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
          ],
        },
      ],
    },
  },
  {
    // ACR-42, ACR-43, and ACR-63 remove the remaining legacy route imports.
    // New target-platform imports are prohibited now so the gap cannot grow.
    files: ["app/routes/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/platform/**", "../platform/**"],
              message:
                "Route adapters compose feature APIs instead of importing platform implementations.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/components/**/*.test.{ts,tsx}"],
    ...testingLibrary.configs["flat/react"],
  },
  {
    files: ["app/components/**/*.test.{ts,tsx}"],
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
