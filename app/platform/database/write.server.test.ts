import { afterEach, describe, expect, it } from "vitest";

import { createTestDatabase } from "../../../test/helpers/database";
import { insertAcronymEntryAtomic } from "./write.server";

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
});

function entry(id: string, definition: string) {
  return {
    id,
    acronym: "API",
    normalizedAcronym: "API",
    definition,
    normalizedDefinition: definition.toLowerCase(),
  };
}
