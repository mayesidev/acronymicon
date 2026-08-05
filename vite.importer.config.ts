import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: "build/scripts",
    rollupOptions: {
      external: [/^node:/, "better-sqlite3"],
      output: {
        entryFileNames: "import-acronyms.mjs",
      },
    },
    ssr: "scripts/import-acronyms.ts",
    target: "node24",
  },
});
