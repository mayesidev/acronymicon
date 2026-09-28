import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: "build/scripts",
    rollupOptions: {
      external: [/^node:/, "better-sqlite3"],
      output: {
        entryFileNames: "revoke-user-sessions.mjs",
      },
    },
    ssr: "scripts/revoke-user-sessions.ts",
    target: "node24",
  },
});
