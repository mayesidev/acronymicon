import { describe, expect, it, vi } from "vitest";

import {
  AuditRecorder,
  expectAuditAttempts,
} from "../../../test/support/audit-recorder";
import { parseDatabaseConfig } from "../config/runtime.server";
import {
  type DatabaseMigrationDependencies,
  runDatabaseMigration,
} from "./migration.server";

describe("database migration operation", () => {
  it("returns the migrated resource when best-effort audit is unavailable", async () => {
    const audit = new AuditRecorder({ available: false });
    const resource = { close: vi.fn() };
    const createDatabase = vi.fn(() => resource);
    const config = databaseConfig();

    await expect(
      runDatabaseMigration(
        config,
        dependencies({ auditPublisher: audit, createDatabase }),
      ),
    ).resolves.toBe(resource);
    expect(createDatabase).toHaveBeenCalledWith({
      databasePath: config.path,
      migrationsFolder: config.migrationsFolder,
      runMigrations: true,
    });
    expectMigrationAttempt(audit, "succeeded");
    expect(JSON.stringify(audit.attempts)).not.toContain(config.path);
    expect(JSON.stringify(audit.attempts)).not.toContain(
      config.migrationsFolder,
    );
  });

  it("records failure and preserves the migration exception", async () => {
    const audit = new AuditRecorder();
    const migrationError = new Error("schema details are private");
    const createDatabase = vi.fn(() => {
      throw migrationError;
    });

    await expect(
      runDatabaseMigration(
        databaseConfig(),
        dependencies({ auditPublisher: audit, createDatabase }),
      ),
    ).rejects.toBe(migrationError);
    expectMigrationAttempt(audit, "failed");
    expect(JSON.stringify(audit.attempts)).not.toContain("private");
  });
});

function databaseConfig() {
  return parseDatabaseConfig({
    DATABASE_PATH: "/private/database.sqlite",
    DRIZZLE_MIGRATIONS_PATH: "/private/migrations",
  });
}

function dependencies(
  overrides: Partial<DatabaseMigrationDependencies> = {},
): DatabaseMigrationDependencies {
  return {
    auditPublisher: new AuditRecorder(),
    createDatabase: vi.fn(() => ({ close: vi.fn() })),
    randomCorrelationId: () => "correlation-123",
    ...overrides,
  };
}

function expectMigrationAttempt(
  audit: AuditRecorder,
  outcome: "succeeded" | "failed",
) {
  expectAuditAttempts(audit, [
    {
      delivery: "best-effort",
      event: {
        correlationId: "correlation-123",
        actor: { type: "system" },
        source: "migration",
        action: "database.migrate",
        target: { type: "application" },
        outcome,
      },
    },
  ]);
}
