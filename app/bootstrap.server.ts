import { getAppConfig, type AppConfig } from "./config.server";
import {
  createDatabase,
  type AppDatabase,
  type DatabaseResource,
} from "./db/client.server";

let databaseResource: DatabaseResource | null = null;
let shutdownHandlersRegistered = false;

export function initializeApplication(
  config: AppConfig = getAppConfig(),
  options: { registerShutdownHandlers?: boolean } = {},
) {
  if (!databaseResource) {
    databaseResource = createDatabase({
      databasePath: config.database.path,
      migrationsFolder: config.database.migrationsFolder,
      runMigrations: config.database.runMigrations,
    });
  }

  if (options.registerShutdownHandlers !== false) {
    registerShutdownHandlers();
  }
  return databaseResource.db;
}

export function getAppDatabase(): AppDatabase {
  if (!databaseResource) {
    throw new Error(
      "Application database is not initialized. Call initializeApplication() during startup.",
    );
  }

  return databaseResource.db;
}

export function closeApplication() {
  databaseResource?.close();
  databaseResource = null;
}

function registerShutdownHandlers() {
  if (shutdownHandlersRegistered) {
    return;
  }

  shutdownHandlersRegistered = true;
  process.once("SIGINT", closeApplication);
  process.once("SIGTERM", closeApplication);
  process.once("beforeExit", closeApplication);
}
