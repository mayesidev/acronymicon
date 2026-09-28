import {
  getAppConfig,
  type AppConfig,
} from "../config/runtime.server";
import { createAuditOutbox } from "../audit/outbox.server";
import {
  createDatabase,
  type AppDatabase,
  type DatabaseResource,
} from "./client.server";

let databaseResource: DatabaseResource | null = null;
let auditOutbox: ReturnType<typeof createAuditOutbox> | null = null;
let shutdownHandlersRegistered = false;

export function initializeApplication(
  config: AppConfig = getAppConfig(),
  options: {
    registerShutdownHandlers?: boolean;
    startAuditDelivery?: boolean;
  } = {},
) {
  if (!databaseResource) {
    databaseResource = createDatabase({
      databasePath: config.database.path,
      migrationsFolder: config.database.migrationsFolder,
      runMigrations: config.database.runMigrations,
    });
    auditOutbox = createAuditOutbox(databaseResource.db);
    if (options.startAuditDelivery !== false) {
      auditOutbox.start();
    }
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

export function getAppAuditOutbox() {
  if (!auditOutbox) {
    throw new Error("Application audit delivery is not initialized.");
  }

  return auditOutbox;
}

export function closeApplication() {
  auditOutbox?.stop();
  auditOutbox = null;
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
