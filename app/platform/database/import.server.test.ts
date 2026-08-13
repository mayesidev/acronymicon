import { afterEach, describe, expect, it } from "vitest";
import { asc } from "drizzle-orm";

import {
  AuditRecorder,
  expectAuditAttempts,
} from "../../../test/support/audit-recorder";
import { createTestDatabase } from "../../../test/helpers/database";
import { acronymEntries } from "./schema";
import {
  importAcronymEntries,
  importAcronymEntriesWithAudit,
} from "./import.server";

describe("acronym import", () => {
  const databases: Array<ReturnType<typeof createTestDatabase>> = [];

  afterEach(() => {
    for (const database of databases.splice(0)) {
      database.remove();
    }
  });

  it("validates input, inserts entries, and skips exact duplicates idempotently", async () => {
    const database = createTestDatabase();
    databases.push(database);
    const entries = [
      {
        acronym: "API",
        definition: "[A]pplication [P]rogramming [I]nterface",
        notes: "  Common software term  ",
        aliases: ["Web API"],
      },
      {
        acronym: "API",
        definition: "Annual Performance Index",
      },
    ];

    expect(importAcronymEntries(database.db, entries)).toMatchObject({
      status: "complete",
      inserted: 2,
      skippedDuplicates: 0,
      failed: 0,
    });

    await expect(
      database.db
        .select()
        .from(acronymEntries)
        .orderBy(asc(acronymEntries.variant)),
    ).resolves.toMatchObject([
      {
        acronym: "API",
        definition: "Application Programming Interface",
        definitionRanges: [
          { start: 0, end: 1 },
          { start: 12, end: 13 },
          { start: 24, end: 25 },
        ],
        variant: 1,
        notes: "Common software term",
        aliases: ["Web API"],
      },
      {
        acronym: "API",
        definition: "Annual Performance Index",
        variant: 2,
      },
    ]);

    expect(importAcronymEntries(database.db, entries)).toMatchObject({
      status: "complete",
      inserted: 0,
      skippedDuplicates: 2,
      failed: 0,
    });
  });

  it("reports invalid input without writing to the database", () => {
    const database = createTestDatabase();
    databases.push(database);

    const result = importAcronymEntries(database.db, [
      { acronym: "", definition: "Missing acronym" },
    ]);

    expect(result.status).toBe("invalid");
  });

  it("isolates malformed definition markup to the failing entry", () => {
    const database = createTestDatabase();
    databases.push(database);

    expect(
      importAcronymEntries(database.db, [
        { acronym: "RADAR", definition: "[Ra]dio [D]etection [" },
        { acronym: "API", definition: "Application Programming Interface" },
      ]),
    ).toMatchObject({
      status: "complete",
      inserted: 1,
      skippedDuplicates: 0,
      failed: 1,
      errors: [{ index: 0 }],
    });
  });
});

describe("audited acronym import", () => {
  const databases: Array<ReturnType<typeof createTestDatabase>> = [];

  afterEach(() => {
    for (const database of databases.splice(0)) {
      database.remove();
    }
  });

  it("records a successful idempotent import without changing the result when the sink is unavailable", async () => {
    const database = createTestDatabase();
    databases.push(database);
    const entries = [
      { acronym: "API", definition: "Application Programming Interface" },
    ];
    importAcronymEntries(database.db, entries);
    const audit = new AuditRecorder({ available: false });

    await expect(
      importAcronymEntriesWithAudit(
        database.db,
        entries,
        auditDependencies(audit),
      ),
    ).resolves.toMatchObject({
      status: "complete",
      inserted: 0,
      skippedDuplicates: 1,
      failed: 0,
    });
    expectImportAttempt(audit, "succeeded");
    expect(JSON.stringify(audit.attempts)).not.toContain("API");
    expect(JSON.stringify(audit.attempts)).not.toContain("Application");
  });

  it("records invalid input as failed", async () => {
    const database = createTestDatabase();
    databases.push(database);
    const audit = new AuditRecorder();

    await expect(
      importAcronymEntriesWithAudit(
        database.db,
        [{ acronym: "", definition: "private definition" }],
        auditDependencies(audit),
      ),
    ).resolves.toMatchObject({ status: "invalid" });
    expectImportAttempt(audit, "failed");
    expect(JSON.stringify(audit.attempts)).not.toContain("private");
  });

  it("records a partially failed import as failed", async () => {
    const database = createTestDatabase();
    databases.push(database);
    const audit = new AuditRecorder();

    await expect(
      importAcronymEntriesWithAudit(
        database.db,
        [
          { acronym: "RADAR", definition: "[Ra]dio [D]etection [" },
          { acronym: "API", definition: "Application Programming Interface" },
        ],
        auditDependencies(audit),
      ),
    ).resolves.toMatchObject({ status: "complete", inserted: 1, failed: 1 });
    expectImportAttempt(audit, "failed");
  });
});

function auditDependencies(auditPublisher: AuditRecorder) {
  return {
    auditPublisher,
    randomCorrelationId: () => "correlation-123",
  };
}

function expectImportAttempt(
  audit: AuditRecorder,
  outcome: "succeeded" | "failed",
) {
  expectAuditAttempts(audit, [
    {
      delivery: "best-effort",
      event: {
        correlationId: "correlation-123",
        actor: { type: "system" },
        source: "maintenance",
        action: "acronym.import",
        target: { type: "application" },
        outcome,
      },
    },
  ]);
}
