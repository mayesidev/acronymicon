import type { AuditPublisher } from "../../domain/audit";
import { auditPublisher } from "../audit/runtime.server";
import type { DatabaseConfig } from "../config/runtime.server";
import { createDatabase, type DatabaseResource } from "./client.server";

type MigrationDatabaseResource = Pick<DatabaseResource, "close">;

type MigrationDatabaseFactory = (
  options: Parameters<typeof createDatabase>[0],
) => MigrationDatabaseResource;

export type DatabaseMigrationDependencies = Readonly<{
  auditPublisher: AuditPublisher;
  createDatabase: MigrationDatabaseFactory;
  randomCorrelationId: () => string;
}>;

const defaultDependencies: DatabaseMigrationDependencies = {
  auditPublisher,
  createDatabase,
  randomCorrelationId: () => crypto.randomUUID(),
};

export async function runDatabaseMigration(
  config: DatabaseConfig,
  dependencies: DatabaseMigrationDependencies = defaultDependencies,
): Promise<MigrationDatabaseResource> {
  const correlationId = dependencies.randomCorrelationId();
  let database: MigrationDatabaseResource;

  try {
    database = dependencies.createDatabase({
      databasePath: config.path,
      migrationsFolder: config.migrationsFolder,
      runMigrations: true,
    });
  } catch (error) {
    await publishMigrationOutcome(dependencies, correlationId, "failed");
    throw error;
  }

  await publishMigrationOutcome(dependencies, correlationId, "succeeded");
  return database;
}

function publishMigrationOutcome(
  dependencies: DatabaseMigrationDependencies,
  correlationId: string,
  outcome: "succeeded" | "failed",
) {
  return dependencies.auditPublisher.publish({
    delivery: "best-effort",
    event: {
      correlationId,
      actor: { type: "system" },
      source: "migration",
      action: "database.migrate",
      target: { type: "application" },
      outcome,
    },
  });
}
