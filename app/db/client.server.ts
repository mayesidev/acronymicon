import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

import { getAppConfig } from "../config.server";
import * as schema from "./schema";

export function createDatabase(options: {
  databasePath?: string;
  migrationsFolder?: string;
  runMigrations?: boolean;
} = {}) {
  const config = getAppConfig().database;
  const databasePath = options.databasePath ?? config.path;

  mkdirSync(dirname(databasePath), { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  if (options.runMigrations ?? config.runMigrations) {
    migrate(db, {
      migrationsFolder: options.migrationsFolder ?? config.migrationsFolder,
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
