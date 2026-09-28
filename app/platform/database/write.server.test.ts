import { afterEach, describe, expect, it } from "vitest";

import { createTestDatabase } from "../../../test/helpers/database";
import { acronymEntries, pendingAuditEvents } from "./schema";
import {
  insertAcronymEntryAtomic,
  PendingAuditCapacityError,
} from "./write.server";

describe("atomic acronym write", () => {
  const databases: Array<ReturnType<typeof createTestDatabase>> = [];

  afterEach(() => {
    for (const database of databases.splice(0)) {
      database.remove();
    }
  });

  it("assigns variants and returns exact duplicates in one transaction", () => {
    const database = createTestDatabase();
    databases.push(database);

    expect(
      insertAcronymEntryAtomic(
        database.db,
        entry("entry-1", "Application Programming Interface"),
      ),
    ).toMatchObject({
      status: "created",
      entry: { id: "entry-1", variant: 1 },
    });
    expect(
      insertAcronymEntryAtomic(
        database.db,
        entry("entry-2", "Annual Performance Index"),
      ),
    ).toMatchObject({
      status: "created",
      entry: { id: "entry-2", variant: 2 },
    });
    expect(
      insertAcronymEntryAtomic(
        database.db,
        entry("entry-3", "Application Programming Interface"),
      ),
    ).toEqual({
      status: "duplicate",
      duplicate: {
        id: "entry-1",
        definition: "Application Programming Interface",
      },
    });
  });

  it("commits a minimal submission event with the new entry", () => {
    const database = createTestDatabase();
    databases.push(database);

    const result = insertAcronymEntryAtomic(
      database.db,
      entry("entry-audited", "Private Definition"),
      { submissionAudit: submissionAudit("correlation-1") },
    );

    expect(result.status).toBe("created");
    const [pending] = database.db.select().from(pendingAuditEvents).all();
    expect(pending).toMatchObject({
      correlationId: "correlation-1",
      event: {
        schemaVersion: 1,
        timestamp: "2026-09-28T12:00:00.000Z",
        correlationId: "correlation-1",
        actor: { type: "user", id: "user-1" },
        action: "acronym.submit",
        target: { type: "acronym-entry", id: "entry-audited" },
        outcome: "succeeded",
      },
    });
    expect(JSON.stringify(pending?.event)).not.toContain("Private Definition");

    expect(
      insertAcronymEntryAtomic(
        database.db,
        entry("entry-duplicate", "Private Definition"),
        { submissionAudit: submissionAudit("correlation-duplicate") },
      ),
    ).toMatchObject({ status: "duplicate" });
    expect(database.db.select().from(pendingAuditEvents).all()).toHaveLength(1);
  });

  it("rolls back the entry if its audit record cannot be stored", () => {
    const database = createTestDatabase();
    databases.push(database);

    insertAcronymEntryAtomic(
      database.db,
      entry("entry-1", "First definition"),
      { submissionAudit: submissionAudit("correlation-1") },
    );

    expect(() =>
      insertAcronymEntryAtomic(
        database.db,
        entry("entry-2", "Second definition"),
        { submissionAudit: submissionAudit("correlation-1") },
      ),
    ).toThrow();
    expect(database.db.select().from(acronymEntries).all()).toHaveLength(1);
    expect(database.db.select().from(pendingAuditEvents).all()).toHaveLength(1);
  });

  it("rejects a new entry before commit when the pending queue is full", () => {
    const database = createTestDatabase();
    databases.push(database);

    insertAcronymEntryAtomic(
      database.db,
      entry("entry-1", "First definition"),
      {
        submissionAudit: submissionAudit("correlation-1"),
        pendingAuditLimit: 1,
      },
    );

    expect(() =>
      insertAcronymEntryAtomic(
        database.db,
        entry("entry-2", "Second definition"),
        {
          submissionAudit: submissionAudit("correlation-2"),
          pendingAuditLimit: 1,
        },
      ),
    ).toThrow(PendingAuditCapacityError);
    expect(database.db.select().from(acronymEntries).all()).toHaveLength(1);
    expect(database.db.select().from(pendingAuditEvents).all()).toHaveLength(1);
  });
});

function submissionAudit(correlationId: string) {
  return {
    correlationId,
    actorId: "user-1",
    timestamp: "2026-09-28T12:00:00.000Z",
  };
}

function entry(id: string, definition: string) {
  return {
    id,
    acronym: "API",
    normalizedAcronym: "API",
    definition,
    normalizedDefinition: definition.toLowerCase(),
  };
}
