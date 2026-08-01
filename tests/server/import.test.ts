import { afterEach, describe, expect, it } from "vitest";

import { importAcronymEntries } from "../../app/db/import.server";
import { createTestDatabase } from "../helpers/database";

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
        definition: "Application Programming Interface",
        tags: ["software"],
      },
      {
        acronym: "API",
        definition: "Annual Performance Index",
      },
    ];

    await expect(importAcronymEntries(database.db, entries)).resolves.toMatchObject({
      status: "complete",
      inserted: 2,
      skippedDuplicates: 0,
      failed: 0,
    });

    await expect(importAcronymEntries(database.db, entries)).resolves.toMatchObject({
      status: "complete",
      inserted: 0,
      skippedDuplicates: 2,
      failed: 0,
    });
  });

  it("reports invalid input without writing to the database", async () => {
    const database = createTestDatabase();
    databases.push(database);

    const result = await importAcronymEntries(database.db, [
      { acronym: "", definition: "Missing acronym" },
    ]);

    expect(result.status).toBe("invalid");
  });
});
