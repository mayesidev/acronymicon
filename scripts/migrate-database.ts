import { getAppConfig } from "../app/platform/config/runtime.server";
import { createDatabase } from "../app/db/client.server";

const config = getAppConfig();
const database = createDatabase({
  databasePath: config.database.path,
  migrationsFolder: config.database.migrationsFolder,
  runMigrations: true,
});

database.close();
