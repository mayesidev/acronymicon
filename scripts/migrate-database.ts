import { getAppConfig } from "../app/platform/config/runtime.server";
import { createDatabase } from "../app/platform/database/client.server";

const config = getAppConfig();
const database = createDatabase({
  databasePath: config.database.path,
  migrationsFolder: config.database.migrationsFolder,
  runMigrations: true,
});

database.close();
