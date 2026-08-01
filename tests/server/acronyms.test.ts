import { afterEach, describe, expect, it } from "vitest";

import { createAcronymRepository } from "../../app/db/acronyms.server";
import { buildNewAcronymEntry } from "../../app/db/acronyms.server";
import { createTestDatabase } from "../helpers/database";

describe("acronym repository", () => {
  const databases: Array<ReturnType<typeof createTestDatabase>> = [];

  afterEach(() => {
    for (const database of databases.splice(0)) {
      database.remove();
    }
  });

  it("builds a published entry with normalized duplicate keys", () => {
    const entry = buildNewAcronymEntry({
      acronym: " api ",
      definition: " Application   Programming Interface ",
      notes: "  A protocol boundary. ",
      submittedByUsername: " user ",
    });

    expect(entry).toMatchObject({
      acronym: "api",
      normalizedAcronym: "API",
      definition: "Application   Programming Interface",
      normalizedDefinition: "application programming interface",
      notes: "A protocol boundary.",
      status: "published",
      submittedByUsername: "user",
    });
  });

  it("enforces exact duplicates while allowing distinct definitions", async () => {
    const database = createTestDatabase();
    databases.push(database);
    const repository = createAcronymRepository(database.db);

    await repository.createAcronymEntry({
      acronym: "API",
      definition: "Application Programming Interface",
    });

    const duplicate = await repository.findExactDuplicate({
      acronym: " api ",
      definition: "Application   Programming Interface",
    });

    expect(duplicate?.id).toEqual(expect.any(String));

    await expect(
      repository.findExactDuplicate({
        acronym: "API",
        definition: "Annual Performance Index",
      }),
    ).resolves.toBeNull();
  });

  it("searches published entries through user-visible fields", async () => {
    const database = createTestDatabase();
    databases.push(database);
    const repository = createAcronymRepository(database.db);

    await repository.createAcronymEntry({
      acronym: "API",
      definition: "Application Programming Interface",
      notes: "Systems integration",
      tags: ["software"],
    });

    await expect(repository.listPublishedAcronyms("integration")).resolves.toHaveLength(1);
    await expect(repository.listPublishedAcronyms("missing")).resolves.toHaveLength(0);
  });
});
