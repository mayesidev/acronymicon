import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

import * as schema from "./schema";

const databasePath = process.env.DATABASE_PATH ?? "./data/acronymicon.sqlite";

mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

if (process.env.RUN_MIGRATIONS_ON_STARTUP !== "false") {
  migrate(db, {
    migrationsFolder: process.env.DRIZZLE_MIGRATIONS_PATH ?? "./drizzle",
  });
}
