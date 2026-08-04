import { afterEach, describe, expect, it } from "vitest";

import { createTestDatabase } from "../../test/helpers/database";
import { importAcronymEntries } from "./import.server";

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
      },
      {
        acronym: "API",
        definition: "Annual Performance Index",
      },
    ];

    await expect(
      importAcronymEntries(database.db, entries),
    ).resolves.toMatchObject({
      status: "complete",
      inserted: 2,
      skippedDuplicates: 0,
      failed: 0,
    });

    await expect(
      importAcronymEntries(database.db, entries),
    ).resolves.toMatchObject({
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

  it("isolates malformed definition markup to the failing entry", async () => {
    const database = createTestDatabase();
    databases.push(database);

    await expect(
      importAcronymEntries(database.db, [
        { acronym: "RADAR", definition: "[Ra]dio [D]etection [" },
        { acronym: "API", definition: "Application Programming Interface" },
      ]),
    ).resolves.toMatchObject({
      status: "complete",
      inserted: 1,
      skippedDuplicates: 0,
      failed: 1,
      errors: [{ index: 0 }],
    });
  });
});
