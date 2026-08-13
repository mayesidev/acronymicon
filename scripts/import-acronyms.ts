import { readFile } from "node:fs/promises";

import { getDatabaseConfig } from "../app/platform/config/runtime.server";
import { createDatabase } from "../app/platform/database/client.server";
import { importAcronymEntriesWithAudit } from "../app/platform/database/import.server";

const inputArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== "--");
const inputPath = inputArguments.length === 1 ? inputArguments[0] : undefined;

if (!inputPath) {
  console.error("Usage: pnpm run import:acronyms [--] <path-to-json>");
  process.exit(1);
}

const config = getDatabaseConfig();
const database = createDatabase({
  databasePath: config.path,
  migrationsFolder: config.migrationsFolder,
  runMigrations: config.runMigrations,
});
let exitCode = 0;

try {
  const rawInput = await readFile(inputPath, "utf8");
  const result = await importAcronymEntriesWithAudit(
    database.db,
    JSON.parse(rawInput),
  );

  if (result.status === "invalid") {
    console.error("Import file is invalid:");
    console.error(result.error);
    exitCode = 1;
  } else {
    for (const index of result.errors) {
      console.error(
        `Failed to import entry at index ${index.index}:`,
        index.error,
      );
    }

    console.error(
      `Import complete: ${result.inserted} inserted, ${result.skippedDuplicates} duplicates skipped, ${result.failed} failed.`,
    );

    if (result.failed > 0) {
      exitCode = 1;
    }
  }
} finally {
  database.close();
}

process.exitCode = exitCode;
