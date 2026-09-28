import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestDatabase } from "../../../test/helpers/database";
import { createDatabase } from "../database/client.server";
import { pendingAuditEvents } from "../database/schema";
import { insertAcronymEntryAtomic } from "../database/write.server";
import { createAuditOutbox } from "./outbox.server";

describe("durable submission audit delivery", () => {
  const databases: Array<ReturnType<typeof createTestDatabase>> = [];

  afterEach(() => {
    for (const database of databases.splice(0)) {
      database.remove();
    }
  });

  it("keeps the event on sink failure and sends it once when output recovers", async () => {
    const database = createTestDatabase();
    databases.push(database);
    insertAuditedEntry(database.db, "entry-1", "correlation-1");
    const publish = vi
      .fn()
      .mockResolvedValueOnce({ status: "unavailable", delivery: "best-effort" })
      .mockResolvedValue({ status: "recorded" });
    const outbox = createAuditOutbox(database.db, publish);

    await outbox.drain();
    expect(database.db.select().from(pendingAuditEvents).all()).toHaveLength(1);

    await Promise.all([outbox.drain(), outbox.drain()]);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish.mock.calls[1]?.[0]).toMatchObject({
      timestamp: "2026-09-28T12:00:00.000Z",
      correlationId: "correlation-1",
      target: { type: "acronym-entry", id: "entry-1" },
    });
    expect(database.db.select().from(pendingAuditEvents).all()).toEqual([]);
  });

  it("replays a pending event after the database is reopened", async () => {
    const directory = mkdtempSync(join(tmpdir(), "acronymicon-audit-replay-"));
    const databasePath = join(directory, "acronymicon.sqlite");
    const options = {
      databasePath,
      migrationsFolder: join(process.cwd(), "drizzle"),
      runMigrations: true,
    };

    try {
      const original = createDatabase(options);
      insertAuditedEntry(original.db, "entry-1", "correlation-1");
      original.close();

      const reopened = createDatabase(options);
      try {
        const publish = vi.fn().mockResolvedValue({ status: "recorded" });
        const outbox = createAuditOutbox(reopened.db, publish);
        outbox.start();
        await outbox.drain();
        outbox.stop();

        expect(publish).toHaveBeenCalledOnce();
        expect(publish.mock.calls[0]?.[0]).toMatchObject({
          timestamp: "2026-09-28T12:00:00.000Z",
          correlationId: "correlation-1",
        });
        expect(reopened.db.select().from(pendingAuditEvents).all()).toEqual([]);
      } finally {
        reopened.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("drains only one bounded batch per attempt", async () => {
    const database = createTestDatabase();
    databases.push(database);
    insertAuditedEntry(database.db, "entry-1", "correlation-1");
    insertAuditedEntry(database.db, "entry-2", "correlation-2");
    const publish = vi.fn().mockResolvedValue({ status: "recorded" });
    const outbox = createAuditOutbox(database.db, publish, { batchSize: 1 });

    await outbox.drain();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(database.db.select().from(pendingAuditEvents).all()).toHaveLength(1);

    await outbox.drain();
    expect(publish).toHaveBeenCalledTimes(2);
    expect(database.db.select().from(pendingAuditEvents).all()).toEqual([]);
  });
});

function insertAuditedEntry(
  database: ReturnType<typeof createTestDatabase>["db"],
  id: string,
  correlationId: string,
) {
  insertAcronymEntryAtomic(
    database,
    {
      id,
      acronym: "API",
      normalizedAcronym: "API",
      definition: `Definition ${id}`,
      normalizedDefinition: `definition ${id}`,
    },
    {
      submissionAudit: {
        correlationId,
        actorId: "user-1",
        timestamp: "2026-09-28T12:00:00.000Z",
      },
    },
  );
}
