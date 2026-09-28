import { existsSync } from "node:fs";

import { getDatabaseConfig } from "../app/platform/config/runtime.server";
import { createDatabase } from "../app/platform/database/client.server";
import { revokeUserSessions } from "../app/platform/database/session-revocation.server";

const argumentsWithoutSeparator = process.argv.slice(2).filter((value) => value !== "--");
const userId = argumentsWithoutSeparator.length === 1 ? argumentsWithoutSeparator[0] : undefined;

if (!userId || !userId.trim()) {
  console.error("Usage: pnpm run sessions:revoke [--] <provider-user-id>");
  process.exit(1);
}

const config = getDatabaseConfig();
if (!existsSync(config.path)) {
  console.error("Session database does not exist at the configured DATABASE_PATH.");
  process.exit(1);
}
const database = createDatabase({
  databasePath: config.path,
  migrationsFolder: config.migrationsFolder,
  runMigrations: config.runMigrations,
});

try {
  const result = await revokeUserSessions(database.db, userId);
  console.error(`Revoked ${result.revokedCount} authenticated session(s).`);
  if (result.auditStatus === "unavailable") {
    console.error("Revocation completed, but its audit record was unavailable.");
    process.exitCode = 2;
  }
} finally {
  database.close();
}
