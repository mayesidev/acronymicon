import { getDatabaseConfig } from "../app/platform/config/runtime.server";
import { createDatabase } from "../app/platform/database/client.server";

const config = getDatabaseConfig();
const database = createDatabase({
  databasePath: config.path,
  migrationsFolder: config.migrationsFolder,
  runMigrations: true,
});

database.close();
