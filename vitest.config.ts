import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["app/**/*.test.{ts,tsx}"],
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
        "app/auth/**": {
          statements: 30,
          branches: 30,
          functions: 30,
          lines: 30,
        },
        "app/components/**": {
          statements: 80,
          branches: 55,
          functions: 75,
          lines: 80,
        },
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
