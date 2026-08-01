import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

import * as schema from "./schema";

export function createDatabase(options: {
  databasePath?: string;
  migrationsFolder?: string;
  runMigrations?: boolean;
} = {}) {
  const databasePath =
    options.databasePath ?? process.env.DATABASE_PATH ?? "./data/acronymicon.sqlite";

  mkdirSync(dirname(databasePath), { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  if (
    options.runMigrations ??
    process.env.RUN_MIGRATIONS_ON_STARTUP !== "false"
  ) {
    migrate(db, {
      migrationsFolder:
        options.migrationsFolder ??
        process.env.DRIZZLE_MIGRATIONS_PATH ??
        "./drizzle",
    });
  }

  return {
    db,
    close: () => sqlite.close(),
  };
}

const defaultDatabase = createDatabase();

export type AppDatabase = typeof defaultDatabase.db;
export const db = defaultDatabase.db;
export const closeDatabase = defaultDatabase.close;
