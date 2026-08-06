import { defineConfig } from "vitest/config";

const presentationCoverageThresholds = {
  statements: 80,
  branches: 55,
  functions: 75,
  lines: 80,
};

export default defineConfig({
  test: {
    include: ["app/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["app/**/*.{ts,tsx}"],
      exclude: [
        "app/**/*.test.{ts,tsx}",
        "app/+types/**",
        "app/routes/+types/**",
      ],
      thresholds: {
        statements: 45,
        branches: 30,
        functions: 50,
        lines: 45,
        "app/features/authentication/server/**": {
          statements: 30,
          branches: 30,
          functions: 30,
          lines: 30,
        },
        // Presentation keeps the same policy whether it is shared or feature-owned.
        "app/components/**": presentationCoverageThresholds,
        "app/features/**/components/**": presentationCoverageThresholds,
        "app/features/**/{hooks/**,use-*.{ts,tsx}}":
          presentationCoverageThresholds,
        "app/db/**": {
          statements: 90,
          branches: 80,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
});
