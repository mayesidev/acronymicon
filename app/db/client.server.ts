import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

import * as schema from "./schema";

export function createDatabase(options: {
  databasePath: string;
  migrationsFolder: string;
  runMigrations: boolean;
}) {
  mkdirSync(dirname(options.databasePath), { recursive: true });

  const sqlite = new Database(options.databasePath);

  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");

    const db = drizzle(sqlite, { schema });

    if (options.runMigrations) {
      migrate(db, { migrationsFolder: options.migrationsFolder });
    }

    return {
      db,
      close: () => sqlite.close(),
    };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

export type DatabaseResource = ReturnType<typeof createDatabase>;
export type AppDatabase = DatabaseResource["db"];
